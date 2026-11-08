// Ex. 2: three ways to compute the standard normal distribution function Φ(x).

const SQRT_2PI = Math.sqrt(2 * Math.PI);

// 1. Composite Simpson rule on the density from 0 to |x|, then symmetry: Φ(−x) = 1 − Φ(x).
function phiSimpson(x, subintervals) {
  const n = subintervals % 2 === 0 ? subintervals : subintervals + 1;
  const end = Math.abs(x);
  const h = end / n;
  const density = (t) => Math.exp((-t * t) / 2) / SQRT_2PI;
  let sum = density(0) + density(end);
  for (let i = 1; i < n; i++) {
    sum += (i % 2 === 1 ? 4 : 2) * density(i * h);
  }
  const area = (sum * h) / 3;
  return x >= 0 ? 0.5 + area : 0.5 - area;
}

// 2. Power series of erf: erf(z) = 2/√π Σ (−1)^k z^(2k+1) / (k! (2k+1)), with Φ(x) = ½ (1 + erf(x/√2)).
function phiSeries(x, terms) {
  const z = x / Math.SQRT2;
  let power = z; // (−1)^k z^(2k+1) / k!
  let sum = 0;
  for (let k = 0; k < terms; k++) {
    sum += power / (2 * k + 1);
    power *= (-z * z) / (k + 1);
  }
  const erf = (2 / Math.sqrt(Math.PI)) * sum;
  return 0.5 * (1 + erf);
}

// 3. Fast approximation of erf (Abramowitz-Stegun 7.1.26): normalCdf from js/stats.js.
function phiFast(x) {
  return normalCdf(x);
}

// Reference values Φ(x) for x = −5, −4.5, ..., 5, computed with mpmath at 40 digits.
// They agree with scipy.special.ndtr to a relative 2e-15 and with the NIST table to its 5 decimals.
const PHI_REFERENCE = [
  [-5, 2.8665157187919391e-7],
  [-4.5, 3.3976731247300604e-6],
  [-4, 3.1671241833119921e-5],
  [-3.5, 0.00023262907903552504],
  [-3, 0.0013498980316300945],
  [-2.5, 0.0062096653257761352],
  [-2, 0.022750131948179207],
  [-1.5, 0.066807201268858066],
  [-1, 0.15865525393145705],
  [-0.5, 0.3085375387259869],
  [0, 0.5],
  [0.5, 0.6914624612740131],
  [1, 0.84134474606854295],
  [1.5, 0.93319279873114193],
  [2, 0.97724986805182079],
  [2.5, 0.99379033467422386],
  [3, 0.99865010196836991],
  [3.5, 0.99976737092096447],
  [4, 0.99996832875816688],
  [4.5, 0.99999660232687527],
  [5, 0.99999971334842812],
];

// Reference value at x: from the table when x is one of its points, otherwise null.
function phiReference(x) {
  const row = PHI_REFERENCE.find((pair) => Math.abs(pair[0] - x) < 1e-12);
  return row ? row[1] : null;
}
