// Ex. 2: score distributions on [0, 10] and the experiment with m hackers and n systems.
// Each distribution has: label, mean, variance, fourthMoment (4th central moment),
// bins (probabilities for the chart), continuous, and sample(random).

function createScoreDistribution(name, p) {
  if (name === "beta") {
    return createBetaDistribution();
  }
  const probabilities = name === "uniform" ? new Array(11).fill(1 / 11) : binomialProbabilities(p);
  const label = name === "uniform" ? "Discrete uniform on {0, …, 10}" : `Binomial(10, ${p})`;
  const sample = name === "uniform" ? sampleUniform : (random) => sampleBinomial(random, p);
  return discreteDistribution(label, probabilities, sample);
}

function binomialProbabilities(p) {
  const probabilities = [];
  let coefficient = 1;
  for (let k = 0; k <= 10; k++) {
    probabilities.push(coefficient * Math.pow(p, k) * Math.pow(1 - p, 10 - k));
    coefficient = (coefficient * (10 - k)) / (k + 1);
  }
  return probabilities;
}

function sampleUniform(random) {
  return Math.floor(random() * 11);
}

// 10 independent sub-steps, each passed with probability p.
function sampleBinomial(random, p) {
  let passed = 0;
  for (let i = 0; i < 10; i++) {
    if (random() < p) {
      passed++;
    }
  }
  return passed;
}

function discreteDistribution(label, probabilities, sample) {
  const mean = probabilities.reduce((total, q, k) => total + k * q, 0);
  const variance = probabilities.reduce((total, q, k) => total + (k - mean) ** 2 * q, 0);
  const fourthMoment = probabilities.reduce((total, q, k) => total + (k - mean) ** 4 * q, 0);
  return { label, mean, variance, fourthMoment, bins: probabilities, continuous: false, sample };
}

// Continuous score 10 · Beta(2, 5), skewed to the right.
function createBetaDistribution() {
  const a = 2;
  const b = 5;
  const density = (y) => 30 * y * Math.pow(1 - y, 4); // Beta(2, 5) density on [0, 1]
  const mean = (10 * a) / (a + b);
  const variance = (100 * a * b) / ((a + b) ** 2 * (a + b + 1));

  // 4th central moment with Simpson's rule
  const steps = 4000;
  let fourthMoment = 0;
  for (let i = 0; i <= steps; i++) {
    const y = i / steps;
    const weight = i === 0 || i === steps ? 1 : i % 2 ? 4 : 2;
    fourthMoment += weight * Math.pow(10 * y - mean, 4) * density(y);
  }
  fourthMoment *= 1 / (3 * steps);

  // probability of each unit interval [j, j + 1), for the chart
  const bins = [];
  for (let j = 0; j < 10; j++) {
    let probability = 0;
    for (let i = 0; i < 200; i++) {
      probability += density((j + (i + 0.5) / 200) / 10) / 2000;
    }
    bins.push(probability);
  }

  // Beta(a, b) = G_a / (G_a + G_b), with Gamma variables of integer shape (sums of exponentials)
  const gamma = (shape, random) => {
    let total = 0;
    for (let i = 0; i < shape; i++) {
      total -= Math.log(1 - random());
    }
    return total;
  };
  const sample = (random) => {
    const first = gamma(a, random);
    return (10 * first) / (first + gamma(b, random));
  };
  return {
    label: "10 · Beta(2, 5) (continuous, skewed)",
    mean,
    variance,
    fourthMoment,
    bins,
    continuous: true,
    sample,
  };
}

// Theoretical variance of the unbiased sample variance s² with n observations.
function varianceOfSampleVariance(distribution, n) {
  const sigma4 = distribution.variance * distribution.variance;
  return (distribution.fourthMoment - (sigma4 * (n - 3)) / (n - 1)) / n;
}

// m hackers, n systems each: Welford gives every hacker's sampling mean and variance.
function runExperiment(distribution, n, hackers, seed) {
  const random = createRandom(seed);
  const means = new Float64Array(hackers);
  const variances = new Float64Array(hackers);
  const biasedVariances = new Float64Array(hackers);
  for (let j = 0; j < hackers; j++) {
    const state = createWelford();
    for (let i = 0; i < n; i++) {
      addValue(state, distribution.sample(random));
    }
    means[j] = state.mean;
    variances[j] = sampleVariance(state);
    biasedVariances[j] = biasedVariance(state);
  }
  return { means, variances, biasedVariances };
}
