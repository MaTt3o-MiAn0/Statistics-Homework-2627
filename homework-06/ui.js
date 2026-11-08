// Homework 6 page: Riemann vs Lebesgue (Ex. 1) and the normal CDF (Ex. 2).
(function () {
  const element = (id) => document.getElementById(id);
  const CONVERGENCE_SIZES = [16, 32, 64, 128, 256, 512, 1024];
  const DISPLAY_CAP = 6; // 1/√x is unbounded: the charts show it up to this height
  const state = {};

  function readInteger(id, fallback, min, max) {
    const value = Math.floor(Number(element(id).value));
    return Math.min(max, Math.max(min, Number.isFinite(value) && value !== 0 ? value : fallback));
  }

  // ---------- Ex. 1: charts of the two partitions ----------

  // Axes and curve of f; returns the coordinate transforms for the shapes drawn on top.
  function drawFunctionFrame(canvas, integrand) {
    const context = clearCanvas(canvas);
    const width = canvas.width;
    const height = canvas.height;
    const left = 44;
    const right = 12;
    const top = 12;
    const bottom = 26;
    const curve = [];
    for (let i = 0; i <= 400; i++) {
      const x = integrand.from + ((integrand.to - integrand.from) * (i + 0.5)) / 401;
      curve.push([x, Math.min(integrand.f(x), DISPLAY_CAP)]);
    }
    const yMax = Math.max(...curve.map((point) => point[1])) * 1.1;
    const toX = (x) =>
      left + ((x - integrand.from) / (integrand.to - integrand.from)) * (width - left - right);
    const toY = (y) => height - bottom - (Math.min(y, yMax) / yMax) * (height - top - bottom);

    context.strokeStyle = cssColor("--line");
    context.fillStyle = cssColor("--muted");
    context.lineWidth = 1;
    context.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const y = (yMax * i) / 4;
      context.beginPath();
      context.moveTo(left, toY(y));
      context.lineTo(width - right, toY(y));
      context.stroke();
      context.fillText(formatNumber(y, 3), left - 5, toY(y) + 4);
    }
    context.textAlign = "center";
    context.fillText(formatNumber(integrand.from, 3), toX(integrand.from), height - 8);
    context.fillText(formatNumber(integrand.to, 3), toX(integrand.to), height - 8);

    const drawCurve = () => {
      context.strokeStyle = cssColor("--ink");
      context.lineWidth = 1.5;
      context.beginPath();
      curve.forEach(([x, y], i) => {
        if (i === 0) {
          context.moveTo(toX(x), toY(y));
        } else {
          context.lineTo(toX(x), toY(y));
        }
      });
      context.stroke();
    };
    return { context, toX, toY, drawCurve };
  }

  function drawRiemann(canvas, integrand, n) {
    const { context, toX, toY, drawCurve } = drawFunctionFrame(canvas, integrand);
    const width = (integrand.to - integrand.from) / n;
    context.fillStyle = cssColor("--accent");
    context.strokeStyle = cssColor("--paper");
    for (let i = 0; i < n; i++) {
      const x = integrand.from + i * width;
      const height = integrand.f(x + width / 2);
      context.globalAlpha = 0.55;
      context.fillRect(toX(x), toY(height), toX(x + width) - toX(x), toY(0) - toY(height));
      context.globalAlpha = 1;
      if (n <= 64) {
        context.strokeRect(toX(x), toY(height), toX(x + width) - toX(x), toY(0) - toY(height));
      }
    }
    drawCurve();
  }

  // Each layer is drawn over the samples where f > t, in alternating shades.
  function drawLayers(canvas, integrand, result) {
    const { context, toX, toY, drawCurve } = drawFunctionFrame(canvas, integrand);
    const values = sampleValues(integrand, result.samples);
    const cell = (integrand.to - integrand.from) / result.samples;
    const every = Math.ceil(result.measures.length / 64); // at most 64 layers drawn
    context.fillStyle = cssColor("--accent");
    result.measures.forEach(({ t }, j) => {
      if (j % every !== 0 || t > DISPLAY_CAP) {
        return;
      }
      context.globalAlpha = j % (2 * every) === 0 ? 0.6 : 0.3;
      const yTop = toY(t + (result.thickness * every) / 2);
      const yBottom = toY(t - (result.thickness * every) / 2);
      for (let i = 0; i < values.length; i++) {
        if (values[i] > t) {
          const x = integrand.from + i * cell;
          context.fillRect(toX(x), yTop, toX(x + cell) - toX(x) + 0.5, yBottom - yTop);
        }
      }
    });
    context.globalAlpha = 1;
    drawCurve();
  }

  function errorText(value, exact) {
    return `error ${formatNumber(Math.abs(value - exact), 3)}`;
  }

  function runIntegrals() {
    const integrand = INTEGRANDS[element("func").value];
    const n = readInteger("intervals", 64, 4, 1024);
    const levels = readInteger("levels", 64, 4, 1024);
    const samples = lebesgueSamples(n);

    const riemann = riemannMidpoint(integrand, n);
    const lebesgue = lebesgueLevelSets(integrand, levels, samples);
    drawRiemann(element("r-chart"), integrand, n);
    drawLayers(element("l-chart"), integrand, lebesgue);
    const exactText =
      integrand === INTEGRANDS.dirichlet
        ? "Lebesgue integral 0"
        : `exact ${formatPrecise(integrand.exact)}`;
    element("r-stat").textContent =
      `Riemann sum with N = ${n}: ${formatPrecise(riemann)} (${exactText}, ${errorText(riemann, integrand.exact)}), ${n} evaluations.`;
    element("l-stat").textContent =
      `Level-set estimate with B = ${levels} and M = ${samples} samples: ${formatPrecise(lebesgue.value)} ` +
      `(${errorText(lebesgue.value, integrand.exact)}), ${samples} evaluations.`;

    const rows = convergence(integrand, CONVERGENCE_SIZES);
    drawLinePlot(element("c-chart"), {
      logX: true,
      logY: true,
      x0: 10,
      x1: 10000,
      y0: 1e-8,
      y1: 1,
      xlabel: "evaluations of f",
      series: [
        {
          name: "Riemann midpoint",
          color: cssColor("--accent"),
          pts: rows.map((row) => [row.riemannEvaluations, row.riemann]),
          line: true,
          dots: true,
        },
        {
          name: "Lebesgue level sets",
          color: AMBER,
          pts: rows.map((row) => [row.lebesgueEvaluations, row.lebesgue]),
          line: true,
          dots: true,
        },
      ],
    });
    const riemannTime = averageMilliseconds(() => riemannMidpoint(integrand, 1024));
    const lebesgueTime = averageMilliseconds(() =>
      lebesgueLevelSets(integrand, 1024, lebesgueSamples(1024)),
    );
    element("c-stat").textContent =
      `Measured on this device with N = 1024: Riemann ${formatNumber(riemannTime, 3)} ms, ` +
      `level sets ${formatNumber(lebesgueTime, 3)} ms. Errors equal to 0 are not drawn on the logarithmic axis.`;

    state.integral = {
      integrand,
      n,
      levels,
      samples,
      riemann,
      lebesgue: lebesgue.value,
      riemannTime,
      lebesgueTime,
    };
    showSummary();
  }

  // ---------- Ex. 2: normal CDF ----------

  function drawDensity(canvas, x) {
    const context = clearCanvas(canvas);
    const width = canvas.width;
    const height = canvas.height;
    const left = 12;
    const right = 12;
    const top = 12;
    const bottom = 26;
    const peak = normalDensity(0, 0, 1) * 1.1;
    const toX = (t) => left + ((t + 4) / 8) * (width - left - right);
    const toY = (y) => height - bottom - (y / peak) * (height - top - bottom);
    const edge = Math.max(-4, Math.min(4, x));

    context.fillStyle = cssColor("--accent");
    context.globalAlpha = 0.35;
    context.beginPath();
    context.moveTo(toX(-4), toY(0));
    for (let t = -4; t <= edge; t += 0.02) {
      context.lineTo(toX(t), toY(normalDensity(t, 0, 1)));
    }
    context.lineTo(toX(edge), toY(normalDensity(edge, 0, 1)));
    context.lineTo(toX(edge), toY(0));
    context.closePath();
    context.fill();
    context.globalAlpha = 1;

    context.strokeStyle = cssColor("--ink");
    context.lineWidth = 1.5;
    context.beginPath();
    for (let t = -4; t <= 4.0001; t += 0.02) {
      if (t === -4) {
        context.moveTo(toX(t), toY(normalDensity(t, 0, 1)));
      } else {
        context.lineTo(toX(t), toY(normalDensity(t, 0, 1)));
      }
    }
    context.stroke();

    context.fillStyle = cssColor("--muted");
    context.textAlign = "center";
    for (let t = -4; t <= 4; t += 2) {
      context.fillText(t, toX(t), height - 8);
    }
    context.fillStyle = cssColor("--ink");
    context.fillText(`Φ(${x}) = ${formatPrecise(phiFast(x))}`, toX(edge), top + 12);
  }

  function runNormalCdf() {
    const x = Number(element("x").value) || 0;
    const subintervals = readInteger("simpson", 64, 2, 4096);
    const terms = readInteger("terms", 60, 1, 200);
    const reference = phiReference(x);
    const methods = [
      ["Simpson", () => phiSimpson(x, subintervals), `${subintervals + 1} evaluations`],
      ["erf series", () => phiSeries(x, terms), `${terms} terms`],
      ["Fast erf", () => phiFast(x), "one formula"],
    ];

    element("n-results").innerHTML =
      methods
        .map(([name, compute, effort]) => {
          const value = compute();
          const microseconds = averageMilliseconds(compute) * 1000;
          const error =
            reference === null ? "" : `, error ${formatNumber(Math.abs(value - reference), 3)}`;
          return `<dt>${name}</dt><dd>${value.toPrecision(15)}${error} · ${effort}, ${formatNumber(microseconds, 3)} µs</dd>`;
        })
        .join("") +
      (reference === null
        ? "<dt>Reference</dt><dd>available for x = −5, −4.5, …, 5</dd>"
        : `<dt>Reference</dt><dd>${reference.toPrecision(15)}</dd>`);
    drawDensity(element("n-density"), x);
    drawBenchmark(subintervals, terms);
    drawConvergenceAtTwo();
    state.cdf = { x, subintervals, terms, reference };
    showSummary();
  }

  function drawBenchmark(subintervals, terms) {
    const errorsOf = (compute) =>
      PHI_REFERENCE.map(([x, reference]) => [x, Math.abs(compute(x) - reference)]);
    const simpson = errorsOf((x) => phiSimpson(x, subintervals));
    const series = errorsOf((x) => phiSeries(x, terms));
    const fast = errorsOf(phiFast);
    drawLinePlot(element("n-bench"), {
      logY: true,
      x0: -5,
      x1: 5,
      y0: 1e-17,
      y1: 1e-2,
      xlabel: "x",
      series: [
        {
          name: `Simpson (n = ${subintervals})`,
          color: cssColor("--accent"),
          pts: simpson,
          line: true,
          dots: true,
        },
        { name: `erf series (${terms} terms)`, color: BLUE, pts: series, line: true, dots: true },
        { name: "Fast erf", color: AMBER, pts: fast, line: true, dots: true },
      ],
    });
    const largest = (errors) => formatNumber(Math.max(...errors.map((point) => point[1])), 2);
    element("b-stat").textContent =
      `Largest absolute error: Simpson ${largest(simpson)}, series ${largest(series)}, fast erf ${largest(fast)}. ` +
      "Errors equal to 0 are not drawn.";
    state.benchmark = { simpson: largest(simpson), series: largest(series), fast: largest(fast) };
  }

  function drawConvergenceAtTwo() {
    const reference = phiReference(2);
    const simpson = [2, 4, 8, 16, 32, 64, 128, 256, 512].map((n) => [
      n + 1,
      Math.abs(phiSimpson(2, n) - reference),
    ]);
    const series = [];
    for (let k = 1; k <= 40; k++) {
      series.push([k, Math.abs(phiSeries(2, k) - reference)]);
    }
    const fastError = Math.abs(phiFast(2) - reference);
    drawLinePlot(element("n-conv"), {
      logX: true,
      logY: true,
      x0: 1,
      x1: 1000,
      y0: 1e-17,
      y1: 1,
      xlabel: "work: evaluations (Simpson) or terms (series)",
      series: [
        { name: "Simpson", color: cssColor("--accent"), pts: simpson, line: true, dots: true },
        { name: "erf series", color: BLUE, pts: series, line: true },
        {
          name: "Fast erf (constant)",
          color: AMBER,
          pts: [
            [1, fastError],
            [1000, fastError],
          ],
          line: true,
          dash: [6, 4],
        },
      ],
    });
    element("t-stat").textContent =
      `At x = 2: Simpson with n = 256 has error ${formatNumber(simpson[7][1], 2)}, ` +
      `the series with 20 terms ${formatNumber(series[19][1], 2)}, the fast formula ${formatNumber(fastError, 2)}.`;
  }

  // ---------- summary of the current run ----------

  function showSummary() {
    if (!state.integral || !state.cdf || !state.benchmark) {
      return;
    }
    const { integrand, n, levels, samples, riemann, lebesgue, riemannTime, lebesgueTime } =
      state.integral;
    const { x, subintervals, terms, reference } = state.cdf;
    const item = (title, text) => `<li><strong>${title}.</strong> ${text}</li>`;
    const target =
      integrand === INTEGRANDS.dirichlet
        ? "Lebesgue integral 0"
        : `exact ${formatPrecise(integrand.exact)}`;
    element("runSummary").innerHTML = [
      item(
        "Integral",
        `${integrand.label}: Riemann with N = ${n} gives ${formatPrecise(riemann)}, ` +
          `level sets with B = ${levels} and M = ${samples} give ${formatPrecise(lebesgue)} (${target}).`,
      ),
      item(
        "Efficiency",
        `With N = 1024 the level-set method took ${formatNumber(lebesgueTime / riemannTime, 2)} times ` +
          "as long as the Riemann sum on this device.",
      ),
      item(
        "Normal CDF",
        `Φ(${x}) = ${phiSeries(x, terms).toPrecision(12)} with the erf series` +
          (reference === null ? "." : ` (reference ${reference.toPrecision(12)}).`),
      ),
      item(
        "Accuracy",
        `Largest error over x = −5 … 5: Simpson (n = ${subintervals}) ${state.benchmark.simpson}, ` +
          `series (${terms} terms) ${state.benchmark.series}, fast erf ${state.benchmark.fast}.`,
      ),
    ].join("");
  }

  element("runIntegral").addEventListener("click", runIntegrals);
  element("runCdf").addEventListener("click", runNormalCdf);
  for (const id of ["func", "intervals", "levels"]) {
    element(id).addEventListener("change", runIntegrals);
  }
  for (const id of ["x", "simpson", "terms"]) {
    element(id).addEventListener("change", runNormalCdf);
  }
  if (window.matchMedia) {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      runIntegrals();
      runNormalCdf();
    });
  }

  runIntegrals();
  runNormalCdf();
})();
