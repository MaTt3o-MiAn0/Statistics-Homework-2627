// Penetration process: n systems, m attackers, i.i.d. increments X_1, X_2, ...
// Bernoulli: X in {0, 1} with P(X = 1) = p. Rademacher: X in {-1, +1}, each with probability 1/2.

// A model describes one increment: mean, variance, lattice step, range and how to draw it.
function createModel(name, p) {
  if (name === "bernoulli") {
    return {
      name,
      p,
      mean: p,
      variance: p * (1 - p),
      latticeStep: 1,
      min: 0,
      max: 1,
      draw: (random) => (random() < p ? 1 : 0),
    };
  }
  return {
    name,
    p: 0.5,
    mean: 0,
    variance: 1,
    latticeStep: 2,
    min: -1,
    max: 1,
    draw: (random) => (random() < 0.5 ? 1 : -1),
  };
}

// One attacker going through n systems: the running total S_1, ..., S_n.
function simulatePath(model, n, random) {
  const totals = new Float64Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += model.draw(random);
    totals[i] = total;
  }
  return totals;
}

// Total score S_n of m attackers, recorded at the sizes n_1 < n_2 < ... (one pass per attacker).
function totalScoresAt(model, sizes, attackers, seed) {
  const random = createRandom(seed);
  const largest = sizes[sizes.length - 1];
  const result = sizes.map(() => new Float64Array(attackers));
  for (let j = 0; j < attackers; j++) {
    let total = 0;
    let next = 0;
    for (let i = 1; i <= largest; i++) {
      total += model.draw(random);
      if (i === sizes[next]) {
        result[next][j] = total;
        next++;
      }
    }
  }
  return result;
}

// Kolmogorov-Smirnov distance between the empirical distribution of the values and N(0, 1).
function kolmogorovDistance(values) {
  const sorted = Float64Array.from(values).sort();
  const count = sorted.length;
  let distance = 0;
  for (let i = 0; i < count; i++) {
    const theoretical = normalCdf(sorted[i]);
    distance = Math.max(
      distance,
      Math.abs((i + 1) / count - theoretical),
      Math.abs(i / count - theoretical),
    );
  }
  return distance;
}

// Theoretical mean and variance of the three scores at size n.
function theoreticalMoments(model, n) {
  return {
    total: { mean: n * model.mean, variance: n * model.variance },
    average: { mean: model.mean, variance: model.variance / n },
    normalized: { mean: model.mean * Math.sqrt(n), variance: model.variance },
  };
}

// Share of attackers whose average score is farther than epsilon from the mean,
// with the Chebyshev and Hoeffding bounds.
function deviationProbability(model, n, totals, epsilon) {
  let outside = 0;
  for (const total of totals) {
    if (Math.abs(total / n - model.mean) > epsilon) {
      outside++;
    }
  }
  const range = model.max - model.min;
  return {
    n,
    empirical: outside / totals.length,
    chebyshev: Math.min(1, model.variance / (n * epsilon * epsilon)),
    hoeffding: Math.min(1, 2 * Math.exp((-2 * n * epsilon * epsilon) / (range * range))),
  };
}

// Aggregate score of m attackers on n systems, divided by mn, over R repetitions.
function aggregateSpread(model, n, attackers, repetitions, seed) {
  const random = createRandom(seed);
  const averages = new Float64Array(repetitions);
  for (let r = 0; r < repetitions; r++) {
    let total = 0;
    for (let j = 0; j < attackers * n; j++) {
      total += model.draw(random);
    }
    averages[r] = total / (n * attackers);
  }
  return {
    spread: standardDeviation(averages),
    theory: Math.sqrt(model.variance / (n * attackers)),
  };
}
