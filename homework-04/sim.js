// Simulation of the penetration process: n systems, m attackers, i.i.d. increments X_1, X_2, ...
// Two models: Bernoulli (X in {0,1}, P(X=1)=p) and Rademacher (X in {-1,+1}, each with probability 1/2).

function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// model = distribution of one increment: mean mu, variance sigma2, lattice step h, range of values
function makeModel(name, p) {
  return name === "bernoulli"
    ? { name, p, mu: p, sigma2: p * (1 - p), h: 1, lo: 0, hi: 1, draw: (r) => (r() < p ? 1 : 0) }
    : { name, p: 0.5, mu: 0, sigma2: 1, h: 2, lo: -1, hi: 1, draw: (r) => (r() < 0.5 ? 1 : -1) };
}
// one trajectory of the total score S_1, ..., S_n (the attacker goes through the n systems one after the other)
function path(model, n, r) {
  const s = new Float64Array(n); let acc = 0;
  for (let i = 0; i < n; i++) { acc += model.draw(r); s[i] = acc; }
  return s;
}
// S_n of m independent attackers, recorded at the checkpoints n_1 < n_2 < ... (one pass per attacker)
function sampleTotals(model, checkpoints, m, seed) {
  const r = mulberry32(seed), nmax = checkpoints[checkpoints.length - 1];
  const out = checkpoints.map(() => new Float64Array(m));
  for (let j = 0; j < m; j++) {
    let s = 0, c = 0;
    for (let i = 1; i <= nmax; i++) { s += model.draw(r); if (i === checkpoints[c]) { out[c][j] = s; c++; } }
  }
  return out;
}
const mean = (a) => { let s = 0; for (const v of a) s += v; return s / a.length; };
const variance = (a) => { const m = mean(a); let s = 0; for (const v of a) s += (v - m) * (v - m); return s / (a.length - 1); };
// standard normal cdf (Abramowitz-Stegun 7.1.26 for erf, error below 1.5e-7) and normal density
function Phi(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}
const phi = (x, m, s2) => Math.exp(-((x - m) ** 2) / (2 * s2)) / Math.sqrt(2 * Math.PI * s2);
// Kolmogorov-Smirnov distance between the empirical cdf of z and the standard normal cdf
function ksNormal(z) {
  const s = Float64Array.from(z).sort(), m = s.length; let d = 0;
  for (let i = 0; i < m; i++) { const F = Phi(s[i]); d = Math.max(d, Math.abs((i + 1) / m - F), Math.abs(i / m - F)); }
  return d;
}
// theoretical mean and variance of the three quantities at size n
function theory(model, n) {
  return {
    total: { mean: n * model.mu, var: n * model.sigma2 },
    average: { mean: model.mu, var: model.sigma2 / n },
    normalized: { mean: model.mu * Math.sqrt(n), var: model.sigma2 }
  };
}
// share of attackers whose average score is farther than eps from mu, with the Chebyshev and Hoeffding bounds
function llnRow(model, n, totals, eps) {
  let c = 0; for (const s of totals) if (Math.abs(s / n - model.mu) > eps) c++;
  const range = model.hi - model.lo;
  return { n, empirical: c / totals.length, chebyshev: Math.min(1, model.sigma2 / (n * eps * eps)), hoeffding: Math.min(1, 2 * Math.exp(-2 * n * eps * eps / (range * range))) };
}
// aggregate score of m attackers against n systems: T = sum of the S_n of the attackers, R replications
function aggregate(model, n, m, R, seed) {
  const r = mulberry32(seed), vals = new Float64Array(R);
  for (let k = 0; k < R; k++) { let t = 0; for (let j = 0; j < m * n; j++) t += model.draw(r); vals[k] = t / (n * m); }
  return { mean: mean(vals), sd: Math.sqrt(variance(vals)), theorySd: Math.sqrt(model.sigma2 / (n * m)) };
}
if (typeof module !== "undefined") module.exports = { mulberry32, makeModel, path, sampleTotals, mean, variance, Phi, phi, ksNormal, theory, llnRow, aggregate };
