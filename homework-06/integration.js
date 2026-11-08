// Ex. 1: Riemann (partition of the domain) and Lebesgue-inspired (partition of the range) integration.

// Riemann sum with the midpoint of each of the n subintervals: n evaluations of f.
function riemannMidpoint(integrand, n) {
  const width = (integrand.to - integrand.from) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += integrand.f(integrand.from + (i + 0.5) * width);
  }
  return sum * width;
}

// Values of f at the midpoints of m equal cells: used to measure the preimages of the levels.
function sampleValues(integrand, m) {
  const width = (integrand.to - integrand.from) / m;
  const values = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    values[i] = integrand.f(integrand.from + (i + 0.5) * width);
  }
  return values;
}

// Number of sorted values strictly greater than t (binary search).
function countAbove(sorted, t) {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (sorted[middle] <= t) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return sorted.length - low;
}

// Layer-cake formula: for f >= 0, ∫ f = ∫_0^max μ({x : f(x) > t}) dt.
// The range [0, max] is cut into `levels` slices; the measure of each preimage
// {f > t} is estimated as (length of the interval) × (share of the m samples above t).
function lebesgueLevelSets(integrand, levels, m) {
  const sorted = sampleValues(integrand, m).sort();
  const length = integrand.to - integrand.from;
  const top = sorted[sorted.length - 1];
  const thickness = top / levels;
  const measures = [];
  let sum = 0;
  for (let j = 0; j < levels; j++) {
    const t = (j + 0.5) * thickness;
    const measure = (length * countAbove(sorted, t)) / m;
    measures.push({ t, measure });
    sum += measure * thickness;
  }
  return { value: sum, measures, thickness, samples: m };
}

// Samples used by the level-set method for n subintervals: never fewer than 256.
function lebesgueSamples(n) {
  return Math.max(256, 4 * n);
}

// Errors of both methods for increasing n (the level-set method uses n levels).
function convergence(integrand, sizes) {
  return sizes.map((n) => {
    const m = lebesgueSamples(n);
    return {
      n,
      riemann: Math.abs(riemannMidpoint(integrand, n) - integrand.exact),
      lebesgue: Math.abs(lebesgueLevelSets(integrand, n, m).value - integrand.exact),
      riemannEvaluations: n,
      lebesgueEvaluations: m,
    };
  });
}

// Average running time of a computation in milliseconds, over enough repetitions to be measurable.
function averageMilliseconds(compute) {
  let repetitions = 0;
  const start = performance.now();
  do {
    compute();
    repetitions++;
  } while (performance.now() - start < 20 && repetitions < 2000);
  return (performance.now() - start) / repetitions;
}
