// Homework 4 page: trajectories, distributions, law of large numbers, central limit theorem, aggregate score.
(function () {
  const element = (id) => document.getElementById(id);
  const format = (value) => formatNumber(value, 3);
  const prefersReducedMotion =
    window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LLN_SIZES = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  const CLT_SIZES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  const ECDF_COLORS = ["#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#15803d"];
  const state = { ready: false };

  // ---------- inputs ----------

  function readNumber(id, fallback, min, max) {
    const value = Number(element(id).value);
    const valid = Number.isFinite(value) && value !== 0 ? value : fallback;
    return Math.min(max, Math.max(min, valid));
  }

  function readParameters() {
    const model = element("modelSel").value;
    element("p").disabled = model === "rademacher";
    return {
      model,
      p: readNumber("p", 0.3, 0.05, 0.95),
      n: Math.floor(readNumber("n", 10000, 100, 20000)),
      m: Math.floor(readNumber("m", 2000, 10, 5000)),
      seed: Math.floor(Number(element("seed").value)) || 2026,
    };
  }

  // Each model uses its own random stream, so switching model does not change the other one.
  const modelOffset = (params) => (params.model === "bernoulli" ? 0 : 100);

  // ---------- sample trajectories (animated) ----------

  let bandPlots = [];
  let animation = null;
  let animationStart = 0;

  function animate(now) {
    const fraction = prefersReducedMotion ? 1 : Math.min(1, (now - animationStart) / 3000);
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

  // Every step for the first 100 systems, then about 1500 points, so long trajectories stay light.
  function trajectoryIndices(n) {
    const ks = [];
    for (let k = 1; k <= n; k += k < 100 ? 1 : Math.ceil(n / 1500)) {
      ks.push(k);
    }
    if (ks[ks.length - 1] !== n) {
      ks.push(n);
    }
    return ks;
  }

  // The three scalings: value of the score, theoretical center and standard deviation at step k.
  function scalings(model) {
    const sigma = Math.sqrt(model.variance);
    return [
      {
        id: "total",
        value: (total) => total,
        center: (k) => k * model.mean,
        spread: (k) => sigma * Math.sqrt(k),
      },
      {
        id: "avg",
        value: (total, k) => total / k,
        center: () => model.mean,
        spread: (k) => sigma / Math.sqrt(k),
      },
      {
        id: "norm",
        value: (total, k) => total / Math.sqrt(k),
        center: (k) => model.mean * Math.sqrt(k),
        spread: () => sigma,
      },
    ];
  }

  function verticalRange(scaling, paths, ks, model) {
    if (scaling.id === "avg") {
      return [model.mean - 0.5, model.mean + 0.5];
    }
    let low = Infinity;
    let high = -Infinity;
    for (const path of paths) {
      for (const k of ks) {
        low = Math.min(low, path[k - 1]);
        high = Math.max(high, path[k - 1]);
      }
    }
    for (const k of ks) {
      low = Math.min(low, scaling.center(k) - 2 * scaling.spread(k));
      high = Math.max(high, scaling.center(k) + 2 * scaling.spread(k));
    }
    return [low, high];
  }

  function showTrajectories(params) {
    const model = createModel(params.model, params.p);
    const random = createRandom(params.seed + 5 + (params.model === "bernoulli" ? 0 : 1));
    const totals = [];
    for (let j = 0; j < Math.min(params.m, 30); j++) {
      totals.push(simulatePath(model, params.n, random));
    }
    const ks = trajectoryIndices(params.n);

    bandPlots = scalings(model).map((scaling) => {
      const paths = totals.map((path) => path.map((total, i) => scaling.value(total, i + 1)));
      const [y0, y1] = verticalRange(scaling, paths, ks, model);
      return {
        canvas: element("tr-" + scaling.id),
        n: params.n,
        firstK: 1,
        ks,
        paths,
        center: scaling.center,
        spread: scaling.spread,
        y0,
        y1,
        digits: 3,
      };
    });
    replayAnimation();
  }

  // ---------- distributions for increasing n ----------

  // n/1000, n/100, n/10 and n (without repetitions for small n).
  function histogramSizes(n) {
    const sizes = [0.001, 0.01, 0.1, 1].map((share) => Math.max(1, Math.round(n * share)));
    return sizes.filter((size, i) => sizes.indexOf(size) === i);
  }

  // The same horizontal axis for every n, except for the total score, whose spread grows with n.
  function histogramAxis(scalingIndex, size, largest, model, modelName) {
    const sigma = Math.sqrt(model.variance);
    if (scalingIndex === 0) {
      return [
        size * model.mean - 4 * sigma * Math.sqrt(size),
        size * model.mean + 4 * sigma * Math.sqrt(size),
      ];
    }
    if (scalingIndex === 1) {
      return [model.mean - 0.5, model.mean + 0.5];
    }
    return modelName === "rademacher" ? [-4, 4] : [-2, model.mean * Math.sqrt(largest) + 4 * sigma];
  }

  // Histogram of a lattice variable: each bin holds a whole number of possible values,
  // so that discrete distributions are not distorted. The black curve is the normal density.
  function drawLatticeHistogram(canvas, totals, n, model, scalingIndex, axis) {
    canvas.width = 260;
    canvas.height = 150;
    const context = clearCanvas(canvas);
    const width = 260;
    const height = 150;
    const left = 8;
    const right = 8;
    const top = 22;
    const bottom = 22;
    const [low, high] = axis;
    const scale = [1, n, Math.sqrt(n)][scalingIndex];
    const step = model.latticeStep / scale;
    const firstEdge = (model.name === "bernoulli" ? 0 : -n) / scale - step / 2;
    const binWidth = step * Math.max(1, Math.ceil((high - low) / 60 / step));
    const moments = Object.values(theoreticalMoments(model, n))[scalingIndex];

    const counts = {};
    for (const total of totals) {
      const bin = Math.floor((total / scale - firstEdge) / binWidth + 1e-9);
      counts[bin] = (counts[bin] || 0) + 1;
    }
    const visibleBins = Object.keys(counts).filter((bin) => {
      const binStart = firstEdge + bin * binWidth;
      return binStart + binWidth >= low && binStart <= high;
    });
    const densityOf = (bin) => counts[bin] / (totals.length * binWidth);
    let peak = Math.max(0, ...visibleBins.map(densityOf));
    peak = Math.max(peak, normalDensity(moments.mean, moments.mean, moments.variance)) * 1.1;
    const toX = (x) => left + ((x - low) / (high - low)) * (width - left - right);
    const toY = (density) => height - bottom - (density / peak) * (height - bottom - top);

    context.fillStyle = cssColor("--accent");
    context.globalAlpha = 0.8;
    for (const bin of visibleBins) {
      const binStart = firstEdge + bin * binWidth;
      const xStart = Math.max(toX(binStart), left);
      const xEnd = Math.min(toX(binStart + binWidth), width - right);
      const y = toY(densityOf(bin));
      context.fillRect(xStart, y, Math.max(1, xEnd - xStart - 0.5), height - bottom - y);
    }
    context.globalAlpha = 1;

    context.strokeStyle = cssColor("--ink");
    context.lineWidth = 1.5;
    context.beginPath();
    for (let i = 0; i <= 120; i++) {
      const x = low + ((high - low) * i) / 120;
      const y = toY(normalDensity(x, moments.mean, moments.variance));
      if (i === 0) {
        context.moveTo(toX(x), y);
      } else {
        context.lineTo(toX(x), y);
      }
    }
    context.stroke();
    context.strokeStyle = cssColor("--line");
    context.beginPath();
    context.moveTo(left, height - bottom);
    context.lineTo(width - right, height - bottom);
    context.stroke();

    context.fillStyle = cssColor("--muted");
    context.textAlign = "left";
    context.fillText(format(low), left, height - 8);
    context.textAlign = "right";
    context.fillText(format(high), width - right, height - 8);
    context.textAlign = "center";
    context.fillText(format(moments.mean), toX(moments.mean), height - 8);
    context.textAlign = "left";
    context.fillStyle = cssColor("--ink");
    context.fillText("n = " + n, left, 13);
  }

  // Sample mean and variance against theory, at the largest n, for the three scores.
  function showDistributionStats(model, n, totals) {
    const moments = theoreticalMoments(model, n);
    const totalMean = mean(totals);
    const averages = totals.map((total) => total / n);
    const normalized = totals.map((total) => total / Math.sqrt(n));
    const line = (sampleMean, expected, sampleVariance, theoryVariance) =>
      `At n = ${n}: sample mean ${format(sampleMean)} (expected ${format(expected)}), ` +
      `sample variance ${format(sampleVariance)} (theory ${format(theoryVariance)}).`;

    const result = {
      n,
      totalVariance: variance(totals),
      averageMean: totalMean / n,
      averageVariance: variance(averages),
      normalizedMean: totalMean / Math.sqrt(n),
      normalizedVariance: variance(normalized),
      moments,
    };
    element("st-total").textContent = line(
      totalMean,
      moments.total.mean,
      result.totalVariance,
      moments.total.variance,
    );
    element("st-avg").textContent = line(
      result.averageMean,
      moments.average.mean,
      result.averageVariance,
      moments.average.variance,
    );
    element("st-norm").textContent = line(
      result.normalizedMean,
      moments.normalized.mean,
      result.normalizedVariance,
      moments.normalized.variance,
    );
    return result;
  }

  function showVarianceChart(model, sizes, totalsBySize) {
    const colors = [cssColor("--accent"), AMBER, cssColor("--ink")];
    const names = ["Var(Sₙ)", "Var(Sₙ/n)", "Var(Sₙ/√n)"];
    const scales = [(n) => 1, (n) => n, (n) => Math.sqrt(n)];
    const theoryKeys = ["total", "average", "normalized"];
    const series = [];
    const allValues = [];

    names.forEach((name, i) => {
      const theory = sizes.map((n) => [n, theoreticalMoments(model, n)[theoryKeys[i]].variance]);
      const simulated = sizes.map((n, s) => [
        n,
        variance(totalsBySize[s].map((total) => total / scales[i](n))),
      ]);
      series.push({ name, color: colors[i], pts: theory, line: true, dash: [6, 4] });
      series.push({ color: colors[i], pts: simulated, dots: true });
      allValues.push(...theory.map((point) => point[1]), ...simulated.map((point) => point[1]));
    });

    const powerBelow = (value) => Math.pow(10, Math.floor(Math.log10(value)));
    const powerAbove = (value) => Math.pow(10, Math.ceil(Math.log10(value)));
    drawLinePlot(element("d-var"), {
      logX: true,
      logY: true,
      x0: powerBelow(sizes[0]),
      x1: powerAbove(sizes[sizes.length - 1]),
      y0: powerBelow(Math.min(...allValues)),
      y1: powerAbove(Math.max(...allValues)),
      xlabel: "n",
      series,
    });
  }

  function showDistributions(params) {
    const model = createModel(params.model, params.p);
    const sizes = histogramSizes(params.n);
    const totalsBySize = totalScoresAt(model, sizes, params.m, params.seed + modelOffset(params));
    state.distribution = showDistributionStats(
      model,
      sizes[sizes.length - 1],
      totalsBySize[sizes.length - 1],
    );

    ["total", "avg", "norm"].forEach((id, scalingIndex) => {
      const box = element("dg-" + id);
      box.innerHTML = "";
      sizes.forEach((size, s) => {
        const canvas = document.createElement("canvas");
        box.appendChild(canvas);
        const axis = histogramAxis(scalingIndex, size, params.n, model, params.model);
        drawLatticeHistogram(canvas, totalsBySize[s], size, model, scalingIndex, axis);
      });
    });
    showVarianceChart(model, sizes, totalsBySize);
  }

  // ---------- law of large numbers ----------

  let llnData = null;

  function showLawOfLargeNumbers() {
    const epsilon = Math.max(0.005, Math.min(0.5, Number(element("eps").value) || 0.05));
    const rows = llnData.sizes.map((n, i) =>
      deviationProbability(llnData.model, n, llnData.totals[i], epsilon),
    );
    const last = rows[rows.length - 1];
    state.lln = { n: last.n, empirical: last.empirical, chebyshev: last.chebyshev, epsilon };
    if (state.ready) {
      showSummary();
    }
    drawLinePlot(element("l-chart"), {
      logX: true,
      logY: true,
      x0: 10,
      x1: 10000,
      y0: 1e-4,
      y1: 1,
      xlabel: "n",
      series: [
        {
          name: "Chebyshev bound",
          color: AMBER,
          pts: rows.map((row) => [row.n, row.chebyshev]),
          line: true,
          dash: [6, 4],
        },
        {
          name: "Hoeffding bound",
          color: cssColor("--ink"),
          pts: rows.map((row) => [row.n, row.hoeffding]),
          line: true,
          dash: [2, 3],
        },
        {
          name: "Simulated",
          color: cssColor("--accent"),
          pts: rows.map((row) => [row.n, row.empirical]),
          line: true,
          dots: true,
        },
      ],
    });
  }

  function runLawOfLargeNumbers(params) {
    const model = createModel(params.model, params.p);
    const sizes = LLN_SIZES.filter((size) => size <= params.n);
    const totals = totalScoresAt(model, sizes, params.m, params.seed + 1 + modelOffset(params));
    llnData = { model, sizes, totals };
    showLawOfLargeNumbers();
  }

  // ---------- central limit theorem ----------

  // Share of sorted values that are <= x (binary search).
  function empiricalCdf(sorted, x) {
    let low = 0;
    let high = sorted.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (sorted[middle] <= x) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    return low / sorted.length;
  }

  // Empirical distribution functions (curves with sorted values) and the normal one (curve without values).
  function drawCdfChart(canvas, curves) {
    const context = clearCanvas(canvas);
    const width = canvas.width;
    const height = canvas.height;
    const left = 44;
    const right = 12;
    const top = 12;
    const bottom = 34;
    const x0 = -3.5;
    const x1 = 3.5;
    const toX = (x) => left + ((x - x0) / (x1 - x0)) * (width - left - right);
    const toY = (y) => top + (1 - y) * (height - top - bottom);

    context.strokeStyle = cssColor("--line");
    context.fillStyle = cssColor("--muted");
    context.lineWidth = 1;
    context.textAlign = "right";
    for (const y of [0, 0.25, 0.5, 0.75, 1]) {
      drawLine(context, left, toY(y), width - right, toY(y));
      context.fillText(y, left - 5, toY(y) + 4);
    }
    context.textAlign = "center";
    for (let x = -3; x <= 3; x++) {
      drawLine(context, toX(x), top, toX(x), height - bottom);
      context.fillText(x, toX(x), height - bottom + 14);
    }
    context.fillText("standardized score", (left + width - right) / 2, height - 6);

    for (const curve of curves) {
      context.strokeStyle = curve.color;
      context.lineWidth = 2;
      context.setLineDash(curve.dash || []);
      context.beginPath();
      for (let i = 0; i <= 400; i++) {
        const x = x0 + ((x1 - x0) * i) / 400;
        const y = curve.values ? empiricalCdf(curve.values, x) : normalCdf(x);
        if (i === 0) {
          context.moveTo(toX(x), toY(y));
        } else {
          context.lineTo(toX(x), toY(y));
        }
      }
      context.stroke();
      context.setLineDash([]);
    }

    context.textAlign = "left";
    curves.forEach((curve, i) => {
      const y = height - bottom - 14 - (curves.length - 1 - i) * 16;
      context.fillStyle = curve.color;
      context.fillRect(width - right - 90, y - 4, 14, 4);
      context.fillStyle = cssColor("--ink");
      context.fillText(curve.name, width - right - 70, y);
    });
  }

  function drawLine(context, xFrom, yFrom, xTo, yTo) {
    context.beginPath();
    context.moveTo(xFrom, yFrom);
    context.lineTo(xTo, yTo);
    context.stroke();
  }

  function runCentralLimitTheorem(params) {
    const model = createModel(params.model, params.p);
    const attackers = 10 * params.m;
    const sigma = Math.sqrt(model.variance);
    const totalsBySize = totalScoresAt(model, CLT_SIZES, attackers, params.seed + 3);
    const standardized = CLT_SIZES.map((n, i) =>
      Float64Array.from(
        totalsBySize[i],
        (total) => (total - n * model.mean) / (sigma * Math.sqrt(n)),
      ).sort(),
    );
    const distances = standardized.map(kolmogorovDistance);
    const noise = 1.36 / Math.sqrt(attackers);
    const latticeFloor = (n) => (0.1995 * model.latticeStep) / (sigma * Math.sqrt(n));
    const shownSizes = [0, 2, 4, 6, 9];

    drawCdfChart(element("c-cdf"), [
      { name: "Φ", color: cssColor("--ink"), dash: [5, 4] },
      ...shownSizes.map((index, k) => ({
        name: "n = " + CLT_SIZES[index],
        color: ECDF_COLORS[k],
        values: standardized[index],
      })),
    ]);
    drawLinePlot(element("c-chart"), {
      logX: true,
      logY: true,
      x0: 1,
      x1: 1000,
      y0: 0.005,
      y1: 1,
      xlabel: "n",
      series: [
        {
          name: "Sampling noise (5% critical value)",
          color: cssColor("--ink"),
          pts: [
            [1, noise],
            [1000, noise],
          ],
          line: true,
          dash: [2, 3],
        },
        {
          name: "Lattice floor",
          color: AMBER,
          pts: CLT_SIZES.map((n) => [n, latticeFloor(n)]),
          line: true,
          dash: [6, 4],
        },
        {
          name: "Simulated Dₙ",
          color: cssColor("--accent"),
          pts: CLT_SIZES.map((n, i) => [n, distances[i]]),
          line: true,
          dots: true,
        },
      ],
    });
    element("c-info").textContent =
      `${attackers} attackers for each n; critical value 1.36/√${attackers} = ${noise.toFixed(4)}.`;
    state.clt = { n: CLT_SIZES[CLT_SIZES.length - 1], distance: distances[distances.length - 1] };
  }

  // ---------- systems and attackers ----------

  function runAggregate(params) {
    const model = createModel(params.model, params.p);
    const modelIndex = params.model === "bernoulli" ? 0 : 1;
    const points = [];
    [10, 100, 1000].forEach((n, nIndex) => {
      [1, 10, 100].forEach((attackers, mIndex) => {
        const seed = params.seed + 40 + 10 * nIndex + mIndex + 100 * modelIndex;
        points.push([n * attackers, aggregateSpread(model, n, attackers, 200, seed).spread]);
      });
    });
    const sigma = Math.sqrt(model.variance);
    drawLinePlot(element("g-chart"), {
      logX: true,
      logY: true,
      x0: 10,
      x1: 100000,
      y0: 0.001,
      y1: 1,
      xlabel: "m · n",
      series: [
        {
          name: "Theory σ/√(mn)",
          color: cssColor("--ink"),
          pts: [
            [10, sigma / Math.sqrt(10)],
            [100000, sigma / Math.sqrt(100000)],
          ],
          line: true,
          dash: [6, 4],
        },
        { name: "Simulated", color: cssColor("--accent"), pts: points, dots: true },
      ],
    });
  }

  // ---------- summary of the current run ----------

  function showSummary() {
    const { params, distribution: d, lln, clt } = state;
    const model = createModel(params.model, params.p);
    const bernoulli = params.model === "bernoulli";
    const item = (title, text) => `<li><strong>${title}.</strong> ${text}</li>`;
    const normalizedEnd = bernoulli
      ? `, while its mean ${format(d.normalizedMean)} follows p√n = ${format(d.moments.normalized.mean)}: it drifts.`
      : `, and its mean ${format(d.normalizedMean)} is close to 0.`;

    element("runSummary").innerHTML = [
      item(
        "Setup",
        `${bernoulli ? "Bernoulli with p = " + params.p : "Rademacher"}, n = ${params.n} systems, ` +
          `m = ${params.m} attackers, seed ${params.seed}.`,
      ),
      item(
        "Total score",
        `At n = ${d.n} the sample variance of Sₙ is ${format(d.totalVariance)} ` +
          `against the theoretical ${format(d.moments.total.variance)}.`,
      ),
      item(
        "Average score",
        `The sample mean of Sₙ/n is ${format(d.averageMean)} (expected ${format(model.mean)}) ` +
          `and its variance ${format(d.averageVariance)} (theory ${format(d.moments.average.variance)}).`,
      ),
      item(
        "Normalized score",
        `The sample variance of Sₙ/√n is ${format(d.normalizedVariance)} ` +
          `(theory ${format(d.moments.normalized.variance)})${normalizedEnd}`,
      ),
      item(
        "Law of large numbers",
        `At n = ${lln.n} the share of attackers with |Sₙ/n − μ| &gt; ${lln.epsilon} ` +
          `is ${lln.empirical.toFixed(3)} (Chebyshev bound ${lln.chebyshev.toFixed(3)}).`,
      ),
      item(
        "Central limit theorem",
        `The Kolmogorov distance between the ` +
          `${bernoulli ? "standardized Bernoulli score" : "normalized Rademacher score"} and N(0, 1) ` +
          `at n = ${clt.n} is ${clt.distance.toFixed(4)}.`,
      ),
    ].join("");
  }

  // ---------- run everything ----------

  function runAll() {
    const params = readParameters();
    const startTime = performance.now();
    state.params = params;
    state.ready = false;
    document.querySelector("main").setAttribute("data-model", params.model);
    element("runStatus").textContent = "Simulating…";

    // the pauses let the browser repaint between the heavier steps
    const steps = [
      () => {
        showTrajectories(params);
        showDistributions(params);
      },
      () => runLawOfLargeNumbers(params),
      () => runCentralLimitTheorem(params),
      () => {
        runAggregate(params);
        state.ready = true;
        showSummary();
        const seconds = (performance.now() - startTime) / 1000;
        element("runStatus").textContent = `Done in ${seconds.toFixed(1)} s.`;
      },
    ];
    const runStep = (i) => {
      if (i < steps.length) {
        setTimeout(() => {
          steps[i]();
          runStep(i + 1);
        }, 15);
      }
    };
    runStep(0);
  }

  element("runBtn").addEventListener("click", runAll);
  element("replay").addEventListener("click", replayAnimation);
  for (const id of ["modelSel", "n", "m", "p", "seed"]) {
    element(id).addEventListener("change", runAll);
  }
  element("eps").addEventListener("input", () => {
    if (llnData) {
      showLawOfLargeNumbers();
    }
  });
  if (window.matchMedia) {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", runAll);
  }

  runAll();
})();
