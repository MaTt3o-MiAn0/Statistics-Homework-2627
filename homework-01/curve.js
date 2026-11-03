// Toy elliptic curve y² = x³ + 7 (mod 17), shared by the three tasks.

const P = 17; // field modulus
const A = 0; // curve y² = x³ + A·x + B
const B = 7;
const G = { x: 1, y: 5 }; // default base point
const INF = null; // point at infinity (neutral element)

// Modulo that is always in [0, m - 1], also for negative numbers.
function mod(n, m = P) {
  return ((n % m) + m) % m;
}

// Modular inverse: the x in [1, P - 1] with a·x = 1 (mod P). Brute force is enough for P = 17.
function modularInverse(a) {
  const value = mod(a);
  for (let x = 1; x < P; x++) {
    if (mod(value * x) === 1) {
      return x;
    }
  }
  return null;
}

function isOnCurve(point) {
  if (point === INF) {
    return true;
  }
  return mod(point.y * point.y) === mod(point.x * point.x * point.x + A * point.x + B);
}

// Sum of two points: tangent slope for doubling, chord slope otherwise.
function addPoints(first, second) {
  if (first === INF) {
    return second;
  }
  if (second === INF) {
    return first;
  }
  // P + (-P) = point at infinity (same x, opposite y)
  if (first.x === second.x && mod(first.y + second.y) === 0) {
    return INF;
  }

  let slope;
  if (first.x === second.x && first.y === second.y) {
    slope = mod((3 * first.x * first.x + A) * modularInverse(2 * first.y));
  } else {
    slope = mod((second.y - first.y) * modularInverse(second.x - first.x));
  }
  const x = mod(slope * slope - first.x - second.x);
  const y = mod(slope * (first.x - x) - first.y);
  return { x, y };
}

// [1G, 2G, ..., kG] by adding the point again and again.
function multiplyStepByStep(k, point = G) {
  const steps = [];
  let total = INF;
  for (let n = 1; n <= k; n++) {
    total = addPoints(total, point);
    steps.push(total);
  }
  return steps;
}

// k·G with double-and-add: reads the bits of k from the lowest one.
function multiplyFast(k, point = G) {
  let result = INF;
  let power = point; // point, 2·point, 4·point, ...
  let bits = k;
  while (bits > 0) {
    if (bits & 1) {
      result = addPoints(result, power);
    }
    power = addPoints(power, power);
    bits >>= 1;
  }
  return result;
}

// Point as text: "(5, 8)" or "INF".
function formatPoint(point) {
  return point === INF ? "INF" : `(${point.x}, ${point.y})`;
}

// All the points of the curve except the point at infinity.
function allPoints() {
  const points = [];
  for (let x = 0; x < P; x++) {
    for (let y = 0; y < P; y++) {
      if (isOnCurve({ x, y })) {
        points.push({ x, y });
      }
    }
  }
  return points;
}

// Order of a point: the smallest n ≥ 1 with n·point = INF.
function orderOf(point) {
  let multiple = point;
  let n = 1;
  while (multiple !== INF && n <= 1000) {
    multiple = addPoints(multiple, point);
    n++;
  }
  return n;
}

// Fills a <select> with all the points of the curve, with G selected.
function fillPointSelect(select) {
  allPoints().forEach((point, i) => {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = formatPoint(point);
    option.selected = point.x === G.x && point.y === G.y;
    select.appendChild(option);
  });
}
