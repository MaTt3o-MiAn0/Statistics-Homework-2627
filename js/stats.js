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
