// Homework 5 page: Welford demo (Ex. 1) and the sampling experiment (Ex. 2).
(function () {
  const element = (id) => document.getElementById(id);
  const prefersReducedMotion =
    window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SYSTEM_COUNTS = [2, 5, 10, 20, 50, 100, 200, 500, 1000];
  const state = { ready: false };

  // ---------- inputs ----------

  function readNumber(id, fallback, min, max) {
    const value = Number(element(id).value);
    const valid = Number.isFinite(value) && value !== 0 ? value : fallback;
    return Math.min(max, Math.max(min, valid));
  }

  function readParameters() {
    const distribution = element("dist").value;
    element("p").disabled = distribution !== "binomial";
    return {
      distribution,
      p: readNumber("p", 0.3, 0.05, 0.95),
      n: Math.floor(readNumber("n", 100, 2, 5000)),
      m: Math.floor(readNumber("m", 2000, 10, 5000)),
      seed: Math.floor(Number(element("seed").value)) || 2026,
    };
  }

  // ---------- Ex. 1: Welford step by step ----------

  function showWelfordDemo() {
    let values = element("w-data")
      .value.split(/[\s,;]+/)
      .map(Number)
      .filter(Number.isFinite);
    if (element("w-offset").checked) {
      values = values.map((value) => value + 1e9);
    }
    if (values.length < 2) {
      element("w-steps").innerHTML = "";
      element("w-compare").textContent = "Enter at least two numbers.";
      return;
    }

    const welford = createWelford();
    let stepsHtml = "";
    values.forEach((value, i) => {
      const delta = value - welford.mean;
      addValue(welford, value);
      if (i < 12) {
        stepsHtml +=
          `<li><b>k = ${welford.count}</b>x = ${formatNumber(value)} · δ = ${formatNumber(delta)} · ` +
          `M = ${formatNumber(welford.mean)} · SS = ${formatNumber(welford.sumOfSquares)}</li>`;
      }
    });
    element("w-steps").innerHTML = stepsHtml;
    element("w-compare").innerHTML =
      `Welford: s² = <strong>${formatNumber(sampleVariance(welford))}</strong> · ` +
      `two-pass (exact reference): ${formatNumber(twoPassVariance(values))} · ` +
      `textbook one-pass (Σx² − n·x̄²)/(n − 1): <strong>${formatNumber(textbookVariance(values))}</strong>`;
  }

  // ---------- Ex. 2: score distribution ----------

  function showDistribution(distribution) {
    element("dist-chart").innerHTML = barChartHtml(distribution.bins);
    const note = distribution.continuous ? " (bars: probability of each unit interval)." : ".";
    element("dist-info").innerHTML =
      `${distribution.label}: μ = <strong>${formatNumber(distribution.mean)}</strong>, ` +
      `σ² = <strong>${formatNumber(distribution.variance)}</strong>, ` +
      `fourth central moment μ₄ = ${formatNumber(distribution.fourthMoment)}${note}`;
  }

  // ---------- running mean and variance of 20 hackers (animated) ----------

  let bandPlots = [];
  let animation = null;
  let animationStart = 0;

  function animate(now) {
    const fraction = prefersReducedMotion ? 1 : Math.min(1, (now - animationStart) / 2500);
    for (const plot of bandPlots) {
      drawBandPlot(plot, fraction);
    }
    animation = fraction < 1 ? requestAnimationFrame(animate) : null;
  }

  function replayAnimation() {
    if (animation) {
      cancelAnimationFrame(animation);
    }
    animationStart = performance.now();
    animation = requestAnimationFrame(animate);
  }

  function showRunningEstimates(params, distribution) {
    const random = createRandom(params.seed + 1);
    const n = Math.max(params.n, 3);
    const runningMeans = [];
    const runningVariances = [];
    for (let j = 0; j < Math.min(20, params.m); j++) {
      const welford = createWelford();
      const means = new Float64Array(n);
      const variances = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        addValue(welford, distribution.sample(random));
        means[i] = welford.mean;
        variances[i] = sampleVariance(welford);
      }
      runningMeans.push(means);
      runningVariances.push(variances);
    }

    const sigma = Math.sqrt(distribution.variance);
    const spreadOfVariance = (k) =>
      Math.sqrt(Math.max(0, varianceOfSampleVariance(distribution, k)));
    bandPlots = [
      {
        canvas: element("run-mean"),
        n,
        firstK: 1,
        paths: runningMeans,
        center: distribution.mean,
        spread: (k) => sigma / Math.sqrt(k),
        y0: Math.max(0, distribution.mean - 3 * sigma),
        y1: Math.min(10, distribution.mean + 3 * sigma),
      },
      {
        canvas: element("run-var"),
        n,
        firstK: 2,
        paths: runningVariances,
        center: distribution.variance,
        spread: spreadOfVariance,
        y0: 0,
        y1: distribution.variance + 4 * spreadOfVariance(Math.min(n, 10)),
      },
    ];
    replayAnimation();
  }

  // ---------- averages across hackers at the chosen n ----------

  function showAverages(params, distribution) {
    const n = Math.max(params.n, 2);
    const result = runExperiment(distribution, n, params.m, params.seed);
    const main = {
      n,
      averageMean: mean(result.means),
      averageVariance: mean(result.variances),
      averageBiased: mean(result.biasedVariances),
      spreadOfMeans: standardDeviation(result.means),
      spreadOfVariances: standardDeviation(result.variances),
      theoryVarianceOfS2: varianceOfSampleVariance(distribution, n),
    };

    drawHistogram(element("h-mean"), result.means, {
      mean: distribution.mean,
      variance: distribution.variance / n,
      average: main.averageMean,
      label: `sampling means x̄ of the ${params.m} hackers`,
    });
    drawHistogram(element("h-var"), result.variances, {
      mean: distribution.variance,
      variance: main.theoryVarianceOfS2,
      average: main.averageVariance,
      label: `sampling variances s² of the ${params.m} hackers`,
    });

    element("st-mean").textContent =
      `Average of the sampling means: ${formatPrecise(main.averageMean)} (μ = ${formatNumber(distribution.mean)}). ` +
      `Standard deviation across hackers: ${formatNumber(main.spreadOfMeans)} ` +
      `(σ/√n = ${formatNumber(Math.sqrt(distribution.variance / n))}).`;
    element("st-var").textContent =
      `Average of the sampling variances: ${formatPrecise(main.averageVariance)} (σ² = ${formatNumber(distribution.variance)}). ` +
      `Standard deviation across hackers: ${formatNumber(main.spreadOfVariances)} ` +
      `(theory ${formatNumber(Math.sqrt(main.theoryVarianceOfS2))}).`;
    return main;
  }

  // ---------- repetition for different n ----------

  function runForEachSystemCount(params, distribution) {
    return SYSTEM_COUNTS.map((n, i) => {
      const result = runExperiment(distribution, n, params.m, params.seed + 10 + i);
      return {
        n,
        meanRatio: mean(result.means) / distribution.mean,
        varianceRatio: mean(result.variances) / distribution.variance,
        biasedRatio: mean(result.biasedVariances) / distribution.variance,
        spreadOfMeans: standardDeviation(result.means),
        spreadOfVariances: standardDeviation(result.variances),
      };
    });
  }

  function showBiasChart(rows) {
    const biasCurve = [];
    for (let k = 2; k <= 1000; k = Math.ceil(k * 1.15)) {
      biasCurve.push([k, (k - 1) / k]);
    }
    biasCurve.push([1000, 0.999]);

    drawLinePlot(element("n-bias"), {
      logX: true,
      x0: 1,
      x1: 1000,
      y0: 0.4,
      y1: 1.15,
      xlabel: "n (systems per hacker)",
      legend: "br",
      series: [
        {
          name: "Theory for unbiased estimators: 1",
          color: cssColor("--ink"),
          pts: [
            [1, 1],
            [1000, 1],
          ],
          line: true,
          dash: [5, 4],
        },
        {
          name: "Theory for the biased variance: (n−1)/n",
          color: AMBER,
          pts: biasCurve,
          line: true,
          dash: [5, 4],
        },
        {
          name: "Average of x̄ / μ",
          color: cssColor("--accent"),
          pts: rows.map((row) => [row.n, row.meanRatio]),
          dots: true,
        },
        {
          name: "Average of s² / σ²  (divides by n − 1)",
          color: BLUE,
          pts: rows.map((row) => [row.n, row.varianceRatio]),
          dots: true,
        },
        {
          name: "Average of biased variance / σ²  (divides by n)",
          color: AMBER,
          pts: rows.map((row) => [row.n, row.biasedRatio]),
          dots: true,
        },
      ],
    });
  }

  function showSpreadChart(rows, distribution) {
    const theoryMeans = SYSTEM_COUNTS.map((n) => [n, Math.sqrt(distribution.variance / n)]);
    const theoryVariances = SYSTEM_COUNTS.map((n) => [
      n,
      Math.sqrt(varianceOfSampleVariance(distribution, n)),
    ]);
    const allValues = [
      ...theoryMeans.map((point) => point[1]),
      ...theoryVariances.map((point) => point[1]),
      ...rows.map((row) => row.spreadOfVariances),
      ...rows.map((row) => row.spreadOfMeans),
    ];

    drawLinePlot(element("n-sd"), {
      logX: true,
      logY: true,
      x0: 1,
      x1: 1000,
      y0: Math.pow(10, Math.floor(Math.log10(Math.min(...allValues)))),
      y1: Math.pow(10, Math.ceil(Math.log10(Math.max(...allValues)))),
      xlabel: "n (systems per hacker)",
      series: [
        {
          name: "Theory σ/√n",
          color: cssColor("--ink"),
          pts: theoryMeans,
          line: true,
          dash: [5, 4],
        },
        {
          name: "Std. dev. of the sampling means",
          color: cssColor("--accent"),
          pts: rows.map((row) => [row.n, row.spreadOfMeans]),
          dots: true,
        },
        { name: "Theory √Var(s²)", color: AMBER, pts: theoryVariances, line: true, dash: [5, 4] },
        {
          name: "Std. dev. of the sampling variances",
          color: AMBER,
          pts: rows.map((row) => [row.n, row.spreadOfVariances]),
          dots: true,
        },
      ],
    });
  }

  // ---------- summary of the current run ----------

  function showSummary() {
    const { params, distribution, main, rows } = state;
    const at10 = rows[2];
    const at1000 = rows[8];
    const item = (title, text) => `<li><strong>${title}.</strong> ${text}</li>`;
    element("runSummary").innerHTML = [
      item(
        "Setup",
        `${distribution.label} (μ = ${formatNumber(distribution.mean)}, σ² = ${formatNumber(distribution.variance)}), ` +
          `m = ${params.m} hackers, n = ${main.n} systems each, seed ${params.seed}.`,
      ),
      item(
        "Sampling means",
        `Their average is ${formatPrecise(main.averageMean)} against μ = ${formatNumber(distribution.mean)}.`,
      ),
      item(
        "Sampling variances",
        `Their average is ${formatPrecise(main.averageVariance)} against σ² = ${formatNumber(distribution.variance)}. ` +
          `Dividing by n instead of n − 1 gives ${formatPrecise(main.averageBiased)}, ` +
          `close to σ²(n − 1)/n = ${formatNumber((distribution.variance * (main.n - 1)) / main.n)}.`,
      ),
      item(
        "Spread across hackers",
        `The sampling means have standard deviation ${formatNumber(main.spreadOfMeans)} ` +
          `(σ/√n = ${formatNumber(Math.sqrt(distribution.variance / main.n))}), the sampling variances ` +
          `${formatNumber(main.spreadOfVariances)} (theory ${formatNumber(Math.sqrt(main.theoryVarianceOfS2))}).`,
      ),
      item(
        "More systems",
        `From n = 10 to n = 1000 the standard deviation of the sampling means falls from ` +
          `${formatNumber(at10.spreadOfMeans)} to ${formatNumber(at1000.spreadOfMeans)}, and that of the sampling variances from ` +
          `${formatNumber(at10.spreadOfVariances)} to ${formatNumber(at1000.spreadOfVariances)}: about 10 times, as √100 predicts.`,
      ),
    ].join("");
  }

  // ---------- run everything ----------

  function runAll() {
    const params = readParameters();
    const distribution = createScoreDistribution(params.distribution, params.p);
    const startTime = performance.now();
    element("runStatus").textContent = "Simulating…";

    // the pauses let the browser repaint between the heavier steps
    setTimeout(() => {
      showDistribution(distribution);
      showRunningEstimates(params, distribution);
      const main = showAverages(params, distribution);

      setTimeout(() => {
        const rows = runForEachSystemCount(params, distribution);
        showBiasChart(rows);
        showSpreadChart(rows, distribution);
        Object.assign(state, { params, distribution, main, rows, ready: true });
        showSummary();
        const seconds = (performance.now() - startTime) / 1000;
        element("runStatus").textContent = `Done in ${seconds.toFixed(1)} s.`;
      }, 15);
    }, 15);
  }

  element("runBtn").addEventListener("click", runAll);
  element("replay").addEventListener("click", replayAnimation);
  for (const id of ["dist", "n", "m", "p", "seed"]) {
    element(id).addEventListener("change", runAll);
  }
  element("w-data").addEventListener("input", showWelfordDemo);
  element("w-offset").addEventListener("change", showWelfordDemo);
  if (window.matchMedia) {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", runAll);
  }

  showWelfordDemo();
  runAll();
})();
