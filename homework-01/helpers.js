// Small helpers shared by Task 1, 2 and 3. Load it AFTER curve.js.

// Point as text: "(5, 8)" or "INF".
function fmt(pt) {
  return pt === INF ? "INF" : "(" + pt.x + ", " + pt.y + ")";
}

// All affine points of the curve (without INF).
function allPoints() {
  const pts = [];
  for (let x = 0; x < P; x++) {
    for (let y = 0; y < P; y++) {
      if (isOnCurve({ x, y })) pts.push({ x, y });
    }
  }
  return pts;
}

// Order of a point: smallest n >= 1 with nG = INF.
function orderOf(pt) {
  let acc = pt, n = 1;
  while (acc !== INF && n <= 1000) {
    acc = pointAdd(acc, pt);
    n++;
  }
  return n;
}
