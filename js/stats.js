// Basic descriptive statistics shared by the homework pages.

function mean(values) {
  let sum = 0;
  for (const value of values) {
    sum += value;
  }
  return sum / values.length;
}

// Sample variance (denominator n - 1).
function variance(values) {
  const average = mean(values);
  let sumOfSquares = 0;
  for (const value of values) {
    sumOfSquares += (value - average) * (value - average);
  }
  return sumOfSquares / (values.length - 1);
}

// Sample standard deviation (denominator n - 1).
function standardDeviation(values) {
  return Math.sqrt(variance(values));
}

// Standard normal distribution function, with the Abramowitz-Stegun 7.1.26 approximation of erf
// (absolute error of erf below 1.5e-7).
function normalCdf(x) {
  const t = 1 / (1 + (0.3275911 * Math.abs(x)) / Math.SQRT2);
  const polynomial =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const erf = 1 - polynomial * Math.exp((-x * x) / 2);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}
