// Task 2: animated drawing of G, 2G, 3G, ... on the grid of the curve points.
(function () {
  const element = (id) => document.getElementById(id);
  const canvas = element("t2-plot");
  const context = canvas.getContext("2d");
  const MARGIN = 40;
  const CELL = (canvas.width - 2 * MARGIN) / (P - 1);
  const toX = (x) => MARGIN + x * CELL;
  const toY = (y) => canvas.height - MARGIN - y * CELL;
  const prefersReducedMotion =
    window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SEGMENT_DURATION = prefersReducedMotion ? 0 : 600;
  const points = allPoints();

  let steps = [];
  let shown = 0;
  let timer = null;
  let segmentStart = 0;

  // progress (0..1) of the last segment, with an ease-out curve
  function segmentProgress() {
    const linear = SEGMENT_DURATION
      ? Math.min(1, (performance.now() - segmentStart) / SEGMENT_DURATION)
      : 1;
    return 1 - Math.pow(1 - linear, 3);
  }

  const selectedBase = () => points[Number(element("t2-g").value)];

  function drawGrid() {
    context.font = "12px system-ui, sans-serif";
    context.textAlign = "center";
    context.strokeStyle = cssColor("--line");
    context.fillStyle = cssColor("--muted");
    context.lineWidth = 1;
    for (let i = 0; i < P; i++) {
      context.beginPath();
      context.moveTo(toX(i), toY(0));
      context.lineTo(toX(i), toY(P - 1));
      context.stroke();
      context.beginPath();
      context.moveTo(toX(0), toY(i));
      context.lineTo(toX(P - 1), toY(i));
      context.stroke();
      context.fillText(i, toX(i), toY(0) + 22);
      context.fillText(i, toX(0) - 22, toY(i) + 4);
    }
    for (const point of points) {
      context.beginPath();
      context.arc(toX(point.x), toY(point.y), 4, 0, 6.2832);
      context.fill();
    }
  }

  // The path joins successive multiples; the last segment grows during the animation.
  function drawPath(visible, progress, accent) {
    context.lineWidth = 2.5;
    context.strokeStyle = accent;
    let previous = null;
    visible.forEach((point, i) => {
      const isLast = i === visible.length - 1;
      if (point !== INF && previous) {
        const share = isLast ? progress : 1;
        context.globalAlpha = isLast ? 1 : 0.55;
        context.beginPath();
        context.moveTo(toX(previous.x), toY(previous.y));
        context.lineTo(
          toX(previous.x + (point.x - previous.x) * share),
          toY(previous.y + (point.y - previous.y) * share),
        );
        context.stroke();
        context.globalAlpha = 1;
      }
      if (point !== INF) {
        previous = point;
      }
    });
  }

  // Visited multiples with their labels; the current one grows and pulses.
  function drawVisited(visible, progress, accent, now) {
    visible.forEach((point, i) => {
      if (point === INF) {
        return;
      }
      const isLast = i === visible.length - 1;
      const pulse = Math.sin(now / 220);
      const radius = isLast ? 4 + 5 * progress + 1.5 * pulse : 6;
      if (isLast) {
        context.globalAlpha = 0.25;
        context.fillStyle = accent;
        context.beginPath();
        context.arc(toX(point.x), toY(point.y), radius + 6 + 3 * pulse, 0, 6.2832);
        context.fill();
        context.globalAlpha = 1;
      }
      context.fillStyle = accent;
      context.beginPath();
      context.arc(toX(point.x), toY(point.y), radius, 0, 6.2832);
      context.fill();
      context.fillStyle = cssColor("--ink");
      context.fillText(`${i + 1}G`, toX(point.x) + 15, toY(point.y) - 9);
    });
  }

  function draw() {
    const now = performance.now();
    const progress = segmentProgress();
    const accent = cssColor("--accent");
    const visible = steps.slice(0, shown);
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawPath(visible, progress, accent);
    drawVisited(visible, progress, accent, now);
  }

  function animationLoop() {
    draw();
    requestAnimationFrame(animationLoop);
  }

  function updateCaption() {
    if (shown === 0) {
      element("t2-caption").textContent = `G = ${formatPoint(selectedBase())}. Press Step or Play.`;
      return;
    }
    const point = steps[shown - 1];
    let text = `${shown}G = ${formatPoint(point)}`;
    if (point === INF) {
      text += " (point at infinity: the next step starts again from G)";
    }
    if (shown === steps.length) {
      text += `. Done: the toy public key is kG = ${formatPoint(point)}.`;
      element("t2-step").disabled = true;
      stop();
    }
    element("t2-caption").textContent = text;
  }

  function reset() {
    stop();
    const k = Math.min(100, Math.max(1, Math.floor(Number(element("t2-k").value)) || 1));
    steps = multiplyStepByStep(k, selectedBase());
    shown = 0;
    segmentStart = performance.now();
    element("t2-step").disabled = false;
    updateCaption();
  }

  function step() {
    if (shown < steps.length) {
      shown++;
      segmentStart = performance.now();
      updateCaption();
    }
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    element("t2-play").textContent = "Play";
  }

  function togglePlay() {
    if (timer) {
      stop();
      return;
    }
    if (shown >= steps.length) {
      return;
    }
    element("t2-play").textContent = "Pause";
    step();
    timer = setInterval(step, Number(element("t2-speed").value));
  }

  fillPointSelect(element("t2-g"));
  element("t2-step").addEventListener("click", step);
  element("t2-play").addEventListener("click", togglePlay);
  element("t2-reset").addEventListener("click", reset);
  element("t2-g").addEventListener("change", reset);
  element("t2-k").addEventListener("change", reset);
  element("t2-speed").addEventListener("change", () => {
    if (timer) {
      stop();
      togglePlay();
    }
  });
  reset();
  animationLoop();
})();
