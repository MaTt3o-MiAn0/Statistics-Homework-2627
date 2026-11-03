// Number formatting for texts and chart axes.

// Up to `digits` significant digits; large numbers are rounded, very small ones use scientific notation.
function formatNumber(value, digits = 4) {
  const size = Math.abs(value);
  if (size >= 1000) {
    return String(Math.round(value));
  }
  if (size > 0 && size < 0.01) {
    return value.toExponential(1);
  }
  return String(Number(value.toPrecision(digits)));
}

// 5 significant digits, for averages that must show small differences (3.0001).
function formatPrecise(value) {
  return String(Number(value.toPrecision(5)));
}

// Short labels for axis ticks.
function formatTick(value) {
  if (value >= 1 && value < 1e5) {
    return String(Number(value.toPrecision(3)));
  }
  if (value < 1 && value >= 1e-4) {
    return String(Number(value.toPrecision(2)));
  }
  return value.toExponential(0).replace("e+", "e");
}
