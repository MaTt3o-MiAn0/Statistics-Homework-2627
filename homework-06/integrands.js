// Functions to integrate in Ex. 1, with their interval and exact integral.
// All of them are non-negative, which the level-set (Lebesgue) method needs.

// Denominator q of a rational x = p/q in lowest terms, from its continued fraction expansion.
// Grid points are rationals with small denominators, so the expansion ends after a few steps.
function rationalDenominator(x) {
  let [previousQ, q] = [1, 0];
  let rest = x;
  for (let step = 0; step < 40; step++) {
    const whole = Math.floor(rest);
    [previousQ, q] = [q, whole * q + previousQ];
    const fraction = rest - whole;
    if (fraction < 1e-12 || q > 1e9) {
      break;
    }
    rest = 1 / fraction;
  }
  // rounding can spoil the last step: accept q only if p/q really gives x back
  const p = Math.round(x * q);
  return Math.abs(p / q - x) < 1e-12 ? q : Infinity;
}

const INTEGRANDS = {
  sin: { label: "sin(x), x ∈ [0, π]", from: 0, to: Math.PI, exact: 2, f: (x) => Math.sin(x) },
  square: { label: "x², x ∈ [0, 1]", from: 0, to: 1, exact: 1 / 3, f: (x) => x * x },
  stepUp: { label: "1 if x < 0.5, else 3", from: 0, to: 1, exact: 2, f: (x) => (x < 0.5 ? 1 : 3) },
  abs: { label: "|x − 0.5|, x ∈ [0, 1]", from: 0, to: 1, exact: 0.25, f: (x) => Math.abs(x - 0.5) },
  inverseSqrt: {
    label: "1 / √x, x ∈ (0, 1]",
    from: 0,
    to: 1,
    exact: 2,
    f: (x) => 1 / Math.sqrt(x),
  },
  stepDown: {
    label: "1 if x < 0.5, else 0",
    from: 0,
    to: 1,
    exact: 0.5,
    f: (x) => (x < 0.5 ? 1 : 0),
  },
  sinc: {
    label: "sin(x) / x, x ∈ [0, π]",
    from: 0,
    to: Math.PI,
    exact: 1.8519370519824662, // Si(π)
    f: (x) => (x === 0 ? 1 : Math.sin(x) / x),
  },
  thomae: {
    label: "Thomae's function",
    from: 0,
    to: 1,
    exact: 0,
    f: (x) => 1 / rationalDenominator(x),
  },
  dirichlet: {
    label: "Dirichlet function",
    from: 0,
    to: 1,
    exact: 0, // Lebesgue integral; not Riemann-integrable
    // every floating-point number is rational, so the computer only ever sees the value 1
    f: () => 1,
  },
};
