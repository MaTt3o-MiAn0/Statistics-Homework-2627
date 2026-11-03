// Canvas charts shared by the homework pages. Colors come from the CSS theme (light or dark).

const AMBER = "#d97706";
const BLUE = "#3b82f6";

function cssColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function clearCanvas(canvas) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "11px system-ui, sans-serif";
  return context;
}

// Ticks: powers of ten on a logarithmic axis, five evenly spaced values on a linear one.
function axisTicks(from, to, logarithmic) {
  const ticks = [];
  if (logarithmic) {
    for (let k = Math.ceil(Math.log10(from)); k <= Math.floor(Math.log10(to)); k++) {
      ticks.push(Math.pow(10, k));
    }
  } else {
    for (let i = 0; i <= 4; i++) {
      ticks.push(from + ((to - from) * i) / 4);
    }
  }
  return ticks;
}

// Line and dot chart with linear or logarithmic axes.
// options: { x0, x1, y0, y1, logX, logY, xlabel, legend: "br" for bottom right, series: [{ name, color, pts, line, dots, dash }] }
function drawLinePlot(canvas, options) {
  const context = clearCanvas(canvas);
  const width = canvas.width;
  const height = canvas.height;
  const left = 52;
  const right = 14;
  const top = 12;
  const bottom = 36;
  const scaleX = options.logX ? Math.log10 : (v) => v;
  const scaleY = options.logY ? Math.log10 : (v) => v;
  const toX = (x) =>
    left +
    ((scaleX(x) - scaleX(options.x0)) / (scaleX(options.x1) - scaleX(options.x0))) *
      (width - left - right);
  const toY = (y) =>
    top +
    (1 - (scaleY(y) - scaleY(options.y0)) / (scaleY(options.y1) - scaleY(options.y0))) *
      (height - top - bottom);

  context.strokeStyle = cssColor("--line");
  context.fillStyle = cssColor("--muted");
  context.lineWidth = 1;
  context.textAlign = "right";
  for (const y of axisTicks(options.y0, options.y1, options.logY)) {
    context.beginPath();
    context.moveTo(left, toY(y));
    context.lineTo(width - right, toY(y));
    context.stroke();
    context.fillText(formatTick(y), left - 5, toY(y) + 4);
  }
  context.textAlign = "center";
  for (const x of axisTicks(options.x0, options.x1, options.logX)) {
    context.beginPath();
    context.moveTo(toX(x), top);
    context.lineTo(toX(x), height - bottom);
    context.stroke();
    context.fillText(formatTick(x), toX(x), height - bottom + 14);
  }
  context.fillText(options.xlabel, (left + width - right) / 2, height - 6);

  context.save();
  context.beginPath();
  context.rect(left, top, width - left - right, height - top - bottom);
  context.clip();
  for (const series of options.series) {
    const points = options.logY ? series.pts.filter((point) => point[1] > 0) : series.pts;
    drawSeries(context, { ...series, pts: points }, toX, toY);
  }
  context.restore();

  drawLegend(context, options, { width, height, left, right, top, bottom });
}

function drawSeries(context, series, toX, toY) {
  context.strokeStyle = series.color;
  context.fillStyle = series.color;
  context.lineWidth = 2;
  context.setLineDash(series.dash || []);
  if (series.line) {
    context.beginPath();
    series.pts.forEach((point, i) => {
      if (i === 0) {
        context.moveTo(toX(point[0]), toY(point[1]));
      } else {
        context.lineTo(toX(point[0]), toY(point[1]));
      }
    });
    context.stroke();
  }
  context.setLineDash([]);
  if (series.dots) {
    for (const point of series.pts) {
      context.beginPath();
      context.arc(toX(point[0]), toY(point[1]), 4.5, 0, 6.2832);
      context.fill();
    }
  }
}

function drawLegend(context, options, box) {
  const named = options.series.filter((series) => series.name);
  context.textAlign = "left";
  named.forEach((series, i) => {
    const bottomRight = options.legend === "br";
    const y = bottomRight
      ? box.height - box.bottom - 10 - (named.length - 1 - i) * 16
      : box.top + 12 + i * 16;
    const x = bottomRight ? box.width - box.right - 230 : box.left + 10;
    context.fillStyle = series.color;
    context.fillRect(x, y - 4, 14, 4);
    context.fillStyle = cssColor("--ink");
    context.fillText(series.name, x + 20, y);
  });
}

// Normal density with the given mean and variance.
function normalDensity(x, mean, variance) {
  return Math.exp(-((x - mean) * (x - mean)) / (2 * variance)) / Math.sqrt(2 * Math.PI * variance);
}

// Histogram (as a density) with the normal curve of the theoretical mean and variance,
// a dashed line at the theoretical mean and an amber line at the observed average.
function drawHistogram(canvas, values, theory) {
  const context = clearCanvas(canvas);
  const width = canvas.width;
  const height = canvas.height;
  const left = 12;
  const right = 12;
  const top = 14;
  const bottom = 34;
  const spread = Math.sqrt(theory.variance);
  const low = Math.min(theory.mean - 4 * spread, Math.min(...values));
  const high = Math.max(theory.mean + 4 * spread, Math.max(...values));
  const binCount = 40;
  const binWidth = (high - low) / binCount;

  const counts = new Array(binCount).fill(0);
  for (const value of values) {
    counts[Math.min(binCount - 1, Math.floor((value - low) / binWidth))]++;
  }
  const densities = counts.map((count) => count / (values.length * binWidth));
  const peak =
    Math.max(Math.max(...densities), 1 / Math.sqrt(2 * Math.PI * theory.variance)) * 1.12;
  const toX = (x) => left + ((x - low) / (high - low)) * (width - left - right);
  const toY = (y) => height - bottom - (y / peak) * (height - bottom - top);

  context.fillStyle = cssColor("--accent");
  context.globalAlpha = 0.75;
  densities.forEach((density, i) => {
    const x = toX(low + i * binWidth);
    const barWidth = Math.max(1, toX(low + (i + 1) * binWidth) - x - 1);
    context.fillRect(x, toY(density), barWidth, height - bottom - toY(density));
  });
  context.globalAlpha = 1;

  context.strokeStyle = cssColor("--ink");
  context.lineWidth = 1.5;
  context.beginPath();
  for (let step = 0; step <= 150; step++) {
    const x = low + ((high - low) * step) / 150;
    const y = normalDensity(x, theory.mean, theory.variance);
    if (step === 0) {
      context.moveTo(toX(x), toY(y));
    } else {
      context.lineTo(toX(x), toY(y));
    }
  }
  context.stroke();

  context.setLineDash([5, 4]);
  drawVerticalLine(context, toX(theory.mean), top, height - bottom);
  context.setLineDash([]);
  context.strokeStyle = AMBER;
  context.lineWidth = 2;
  drawVerticalLine(context, toX(theory.average), top, height - bottom);

  context.fillStyle = cssColor("--muted");
  context.textAlign = "left";
  context.fillText(formatNumber(low), left, height - bottom + 14);
  context.textAlign = "right";
  context.fillText(formatNumber(high), width - right, height - bottom + 14);
  context.textAlign = "center";
  context.fillText(theory.label, width / 2, height - 6);
}

function drawVerticalLine(context, x, yTop, yBottom) {
  context.beginPath();
  context.moveTo(x, yTop);
  context.lineTo(x, yBottom);
  context.stroke();
}

// Trajectories against k with a dashed center line and a shaded band center ± 2·spread(k).
// fraction (0..1) draws only the first part of each trajectory, for the animation.
// plot: { canvas, n, firstK, paths, center (number or function of k), spread(k), y0, y1,
//         ks (optional: the k values to draw, to keep long trajectories light), digits (axis labels) }
function drawBandPlot(plot, fraction) {
  const canvas = plot.canvas;
  const context = clearCanvas(canvas);
  const width = canvas.width;
  const height = canvas.height;
  const left = 48;
  const right = 10;
  const top = 12;
  const bottom = 26;
  const lastK = Math.max(2, Math.floor(plot.n * fraction));
  const ks = plot.ks || rangeOfK(plot.firstK, plot.n);
  const centerAt = (k) => (typeof plot.center === "function" ? plot.center(k) : plot.center);
  const toX = (k) => left + ((k - 1) / (plot.n - 1)) * (width - left - right);
  const toY = (v) => top + (1 - (v - plot.y0) / (plot.y1 - plot.y0)) * (height - top - bottom);

  context.fillStyle = cssColor("--muted");
  context.strokeStyle = cssColor("--line");
  context.textAlign = "right";
  context.lineWidth = 1;
  for (let t = 0; t <= 4; t++) {
    const value = plot.y0 + ((plot.y1 - plot.y0) * t) / 4;
    context.beginPath();
    context.moveTo(left, toY(value));
    context.lineTo(width - right, toY(value));
    context.stroke();
    context.fillText(formatNumber(value, plot.digits), left - 5, toY(value) + 4);
  }
  context.textAlign = "center";
  for (const k of [1, Math.round(plot.n / 2), plot.n]) {
    context.fillText(k, toX(k), height - 8);
  }

  context.save();
  context.beginPath();
  context.rect(left, top, width - left - right, height - top - bottom);
  context.clip();

  context.fillStyle = cssColor("--accent");
  context.globalAlpha = 0.13;
  context.beginPath();
  ks.forEach((k, i) => {
    const y = toY(centerAt(k) + 2 * plot.spread(k));
    if (i === 0) {
      context.moveTo(toX(k), y);
    } else {
      context.lineTo(toX(k), y);
    }
  });
  for (let i = ks.length - 1; i >= 0; i--) {
    context.lineTo(toX(ks[i]), toY(centerAt(ks[i]) - 2 * plot.spread(ks[i])));
  }
  context.fill();
  context.globalAlpha = 1;

  context.setLineDash([5, 4]);
  context.strokeStyle = cssColor("--ink");
  context.beginPath();
  if (typeof plot.center === "number") {
    context.moveTo(toX(1), toY(plot.center));
    context.lineTo(toX(plot.n), toY(plot.center));
  } else {
    ks.forEach((k, i) => {
      if (i === 0) {
        context.moveTo(toX(k), toY(centerAt(k)));
      } else {
        context.lineTo(toX(k), toY(centerAt(k)));
      }
    });
  }
  context.stroke();
  context.setLineDash([]);

  context.strokeStyle = cssColor("--accent");
  context.lineWidth = 1.2;
  context.globalAlpha = 0.7;
  for (const path of plot.paths) {
    context.beginPath();
    for (let i = 0; i < ks.length && ks[i] <= lastK; i++) {
      const y = toY(path[ks[i] - 1]);
      if (i === 0) {
        context.moveTo(toX(ks[i]), y);
      } else {
        context.lineTo(toX(ks[i]), y);
      }
    }
    context.stroke();
  }
  context.restore();
}

function rangeOfK(first, last) {
  const ks = [];
  for (let k = first; k <= last; k++) {
    ks.push(k);
  }
  return ks;
}

// Vertical bar chart in HTML (uses the .vbars styles), one bar per value.
// options: { labels, title, best (index to highlight), showValues, format (for values and tooltips) }
function barChartHtml(values, options = {}) {
  const labels = options.labels || values.map((value, k) => k);
  const formatValue = options.format || ((value) => value.toFixed(3));
  const highest = Math.max(...values, 1e-9);
  const bars = values.map((value, i) => {
    const height = Math.round((value / highest) * 100);
    const highlight = i === options.best ? " best" : "";
    const shownValue = options.showValues ? `<b>${formatValue(value)}</b>` : "";
    return (
      `<div class="vb${highlight}" title="${labels[i]}: ${formatValue(value)}">${shownValue}` +
      `<span style="height:${height}%"></span><i>${labels[i]}</i></div>`
    );
  });
  const chart = `<div class="vbars">${bars.join("")}</div>`;
  return options.title ? `<div class="chart"><h4>${options.title}</h4>${chart}</div>` : chart;
}
