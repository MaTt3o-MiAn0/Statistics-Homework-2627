// Toy elliptic curve: y^2 = x^3 + 7 (mod 17).  Shared by the Task 1, 2 and 3 pages.

const P = 17;                 // field modulus
const A = 0, B = 7;           // curve y^2 = x^3 + A*x + B
const G = { x: 1, y: 5 };     // default base point
const INF = null;             // point at infinity (neutral element)

// Modulo that is always in [0, m-1], also for negative numbers.
function mod(n, m = P) {
  return ((n % m) + m) % m;
}

// Modular inverse of a mod P: the x in [1, P-1] with a*x = 1 (mod P).
// Brute force is fine because P is tiny. Returns null if no inverse exists (a = 0).
function modInv(a) {
  a = mod(a);
  for (let x = 1; x < P; x++) {
    if (mod(a * x) === 1) return x;
  }
  return null;
}

// True if the point satisfies y^2 = x^3 + A*x + B (mod P). INF counts as on the curve.
function isOnCurve(pt) {
  if (pt === INF) return true;
  return mod(pt.y * pt.y) === mod(pt.x * pt.x * pt.x + A * pt.x + B);
}

// P1 + P2 on the curve. INF is the neutral element.
function pointAdd(p1, p2) {
  if (p1 === INF) return p2;
  if (p2 === INF) return p1;

  // P + (-P) = INF (same x, opposite y; also covers doubling a point with y = 0)
  if (p1.x === p2.x && mod(p1.y + p2.y) === 0) return INF;

  let lambda;
  if (p1.x === p2.x && p1.y === p2.y) {
    // doubling: lambda = (3x^2 + A) / (2y)
    lambda = mod((3 * p1.x * p1.x + A) * modInv(2 * p1.y));
  } else {
    // addition: lambda = (y2 - y1) / (x2 - x1)
    lambda = mod((p2.y - p1.y) * modInv(p2.x - p1.x));
  }

  const x3 = mod(lambda * lambda - p1.x - p2.x);
  const y3 = mod(lambda * (p1.x - x3) - p1.y);
  return { x: x3, y: y3 };
}

// kG by repeated addition. Returns [1G, 2G, ..., kG].
function scalarMulSteps(k, pt = G) {
  const steps = [];
  let acc = INF;
  for (let n = 1; n <= k; n++) {
    acc = pointAdd(acc, pt);
    steps.push(acc);
  }
  return steps;
}

// kG with double-and-add: scan the bits of k from the lowest one.
function scalarMulFast(k, pt = G) {
  let result = INF;
  let addend = pt;           // pt, 2pt, 4pt, 8pt, ...
  while (k > 0) {
    if (k & 1) result = pointAdd(result, addend);
    addend = pointAdd(addend, addend);
    k >>= 1;
  }
  return result;
}
