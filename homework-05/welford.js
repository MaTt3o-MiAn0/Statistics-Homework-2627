// Ex. 1: Welford's recurrences for mean and sum of squares (one pass, constant memory).

function createWelford() {
  return { count: 0, mean: 0, sumOfSquares: 0 };
}

function addValue(state, value) {
  state.count += 1;
  const delta = value - state.mean; // deviation from the OLD mean
  state.mean += delta / state.count; // Knuth: M_k = M_{k-1} + delta / k
  state.sumOfSquares += delta * (value - state.mean); // Welford: SS_k = SS_{k-1} + delta * (x_k - M_k)
}

// Unbiased sample variance (denominator k - 1).
function sampleVariance(state) {
  return state.count > 1 ? state.sumOfSquares / (state.count - 1) : 0;
}

// Biased variance (denominator k).
function biasedVariance(state) {
  return state.count > 0 ? state.sumOfSquares / state.count : 0;
}

// Textbook one-pass formula (sum of x^2 - n * mean^2) / (n - 1): it suffers from cancellation.
function textbookVariance(values) {
  let sum = 0;
  let sumOfSquaredValues = 0;
  for (const value of values) {
    sum += value;
    sumOfSquaredValues += value * value;
  }
  const n = values.length;
  return (sumOfSquaredValues - (sum * sum) / n) / (n - 1);
}

// Reference: first the mean, then the squared deviations.
function twoPassVariance(values) {
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  const squares = values.reduce((total, value) => total + (value - average) * (value - average), 0);
  return squares / (values.length - 1);
}
