(function () {
  var $ = function (id) { return document.getElementById(id); };
  var cv = $("t2-plot"), ctx = cv.getContext("2d");
  var M = 40, CELL = (cv.width - 2 * M) / (P - 1);
  var px = function (x) { return M + x * CELL; }, py = function (y) { return cv.height - M - y * CELL; };
  var css = function (n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DUR = reduce ? 0 : 600;
  var points = allPoints(), steps = [], idx = 0, timer = null, t0 = 0;

  function prog() { return DUR ? Math.min(1, (performance.now() - t0) / DUR) : 1; }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function g() { return points[Number($("t2-g").value)]; }

  function draw() {
    var now = performance.now(), p = ease(prog());
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.font = "12px system-ui, sans-serif"; ctx.textAlign = "center";
    ctx.strokeStyle = css("--line"); ctx.fillStyle = css("--muted"); ctx.lineWidth = 1;
    for (var i = 0; i < P; i++) {
      ctx.beginPath(); ctx.moveTo(px(i), py(0)); ctx.lineTo(px(i), py(P - 1)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(0), py(i)); ctx.lineTo(px(P - 1), py(i)); ctx.stroke();
      ctx.fillText(i, px(i), py(0) + 22); ctx.fillText(i, px(0) - 22, py(i) + 4);
    }
    points.forEach(function (q) { ctx.beginPath(); ctx.arc(px(q.x), py(q.y), 4, 0, 6.2832); ctx.fill(); });
    var shown = steps.slice(0, idx), prev = null, accent = css("--accent");
    ctx.lineWidth = 2.5; ctx.strokeStyle = accent;
    shown.forEach(function (q, i) {
      var last = i === shown.length - 1;
      if (q !== INF && prev) {
        var f = last ? p : 1;
        ctx.globalAlpha = last ? 1 : 0.55;
        ctx.beginPath(); ctx.moveTo(px(prev.x), py(prev.y));
        ctx.lineTo(px(prev.x + (q.x - prev.x) * f), py(prev.y + (q.y - prev.y) * f)); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (q !== INF) prev = q;
    });
    shown.forEach(function (q, i) {
      if (q === INF) return;
      var last = i === shown.length - 1;
      var r = last ? 4 + 5 * p + 1.5 * Math.sin(now / 220) : 6;
      if (last) { ctx.globalAlpha = 0.25; ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(px(q.x), py(q.y), r + 6 + 3 * Math.sin(now / 220), 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1; }
      ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(px(q.x), py(q.y), r, 0, 6.2832); ctx.fill();
      ctx.fillStyle = css("--ink"); ctx.fillText((i + 1) + "G", px(q.x) + 15, py(q.y) - 9);
    });
  }
  function frame() { draw(); requestAnimationFrame(frame); }

  function caption() {
    if (idx === 0) { $("t2-caption").textContent = "G = " + fmt(g()) + ". Press Step or Play."; return; }
    var q = steps[idx - 1], t = idx + "G = " + fmt(q);
    if (q === INF) t += " (point at infinity: the next step starts again from G)";
    if (idx === steps.length) { t += ". Done: the toy public key is kG = " + fmt(q) + "."; $("t2-step").disabled = true; stop(); }
    $("t2-caption").textContent = t;
  }
  function setup() {
    stop();
    var k = Math.min(100, Math.max(1, Math.floor(Number($("t2-k").value)) || 1));
    steps = scalarMulSteps(k, g()); idx = 0; t0 = performance.now(); $("t2-step").disabled = false; caption();
  }
  function step() { if (idx < steps.length) { idx++; t0 = performance.now(); caption(); } }
  function stop() { if (timer) { clearInterval(timer); timer = null; } $("t2-play").textContent = "Play"; }
  function play() {
    if (timer) return stop();
    if (idx >= steps.length) return;
    $("t2-play").textContent = "Pause"; step();
    timer = setInterval(step, Number($("t2-speed").value));
  }
  points.forEach(function (q, i) {
    var o = document.createElement("option"); o.value = i; o.textContent = fmt(q);
    if (q.x === G.x && q.y === G.y) o.selected = true; $("t2-g").appendChild(o);
  });
  $("t2-step").addEventListener("click", step);
  $("t2-play").addEventListener("click", play);
  $("t2-reset").addEventListener("click", setup);
  $("t2-g").addEventListener("change", setup);
  $("t2-k").addEventListener("change", setup);
  $("t2-speed").addEventListener("change", function () { if (timer) { stop(); play(); } });
  setup(); frame();
})();
