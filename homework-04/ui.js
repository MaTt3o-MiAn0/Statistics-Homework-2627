(function () {
  var $ = function (id) { return document.getElementById(id); };
  var css = function (n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var AMBER = "#d97706";
  function fx(v) { var a = Math.abs(v); return a >= 1000 ? String(Math.round(v)) : (a < 0.01 && a > 0) ? v.toExponential(1) : String(+v.toPrecision(3)); }
  function tick(v) { return v >= 1 && v < 1e5 ? String(v) : v < 1 && v >= 1e-4 ? String(+v.toFixed(4)) : v.toExponential(0).replace("e+", "e"); }
  function setup(cv) { var c = cv.getContext("2d"); c.clearRect(0, 0, cv.width, cv.height); c.font = "11px system-ui, sans-serif"; return c; }
  function params() {
    var model = $("modelSel").value;
    $("p").disabled = model === "rademacher";
    var num = function (id, d, lo, hi) { var v = Number($(id).value); return Math.min(hi, Math.max(lo, Number.isFinite(v) && v !== 0 ? v : d)); };
    return { model: model, p: num("p", 0.3, 0.05, 0.95), n: Math.floor(num("n", 10000, 100, 20000)), m: Math.floor(num("m", 2000, 10, 5000)), seed: Math.floor(Number($("seed").value)) || 2026 };
  }

  // ---------- log-log line/dot plot ----------
  function logPlot(cv, o) {
    var ctx = setup(cv), W = cv.width, H = cv.height, L = 58, R = 14, T = 12, B = 38, lg = Math.log10;
    var X = function (x) { return L + (lg(x) - lg(o.x0)) / (lg(o.x1) - lg(o.x0)) * (W - L - R); };
    var Y = function (y) { return T + (1 - (lg(y) - lg(o.y0)) / (lg(o.y1) - lg(o.y0))) * (H - T - B); };
    ctx.strokeStyle = css("--line"); ctx.fillStyle = css("--muted"); ctx.lineWidth = 1;
    ctx.textAlign = "right"; for (var k = Math.ceil(lg(o.y0)); k <= Math.floor(lg(o.y1)); k++) { var y = Math.pow(10, k); ctx.beginPath(); ctx.moveTo(L, Y(y)); ctx.lineTo(W - R, Y(y)); ctx.stroke(); ctx.fillText(tick(y), L - 5, Y(y) + 4); }
    ctx.textAlign = "center"; for (k = Math.ceil(lg(o.x0)); k <= Math.floor(lg(o.x1)); k++) { var x = Math.pow(10, k); ctx.beginPath(); ctx.moveTo(X(x), T); ctx.lineTo(X(x), H - B); ctx.stroke(); ctx.fillText(tick(x), X(x), H - B + 14); }
    ctx.fillText(o.xlabel, (L + W - R) / 2, H - 6);
    o.series.forEach(function (s) {
      var pts = s.pts.filter(function (q) { return q[1] > 0 && Number.isFinite(q[1]); });
      ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = 2; ctx.setLineDash(s.dash || []);
      if (s.line) { ctx.beginPath(); pts.forEach(function (q, i) { var yy = Math.min(Math.max(q[1], o.y0), o.y1); i ? ctx.lineTo(X(q[0]), Y(yy)) : ctx.moveTo(X(q[0]), Y(yy)); }); ctx.stroke(); }
      ctx.setLineDash([]);
      if (s.dots) pts.forEach(function (q) { if (q[1] >= o.y0 && q[1] <= o.y1) { ctx.beginPath(); ctx.arc(X(q[0]), Y(q[1]), 4.5, 0, 6.2832); ctx.fill(); } });
    });
    ctx.textAlign = "left"; o.series.forEach(function (s, i) { ctx.fillStyle = s.color; ctx.fillRect(L + 10, T + 8 + i * 16, 14, 4); ctx.fillStyle = css("--ink"); ctx.fillText(s.name, L + 30, T + 13 + i * 16); });
  }

  // ---------- sample trajectories (animated) ----------
  var plots = [], anim = null, reveal = 0, t0 = 0, S = { ready: false };
  function drawPaths(o, kk) {
    var cv = o.cv, ctx = setup(cv), W = cv.width, H = cv.height, L = 54, R = 10, T = 12, B = 26, kmax = Math.max(2, Math.floor(o.n * kk));
    var X = function (i) { return L + (i - 1) / (o.n - 1) * (W - L - R); };
    var Y = function (v) { return T + (1 - (v - o.y0) / (o.y1 - o.y0)) * (H - T - B); };
    ctx.fillStyle = css("--muted"); ctx.strokeStyle = css("--line"); ctx.textAlign = "right"; ctx.lineWidth = 1;
    for (var t = 0; t <= 4; t++) { var v = o.y0 + (o.y1 - o.y0) * t / 4; ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(W - R, Y(v)); ctx.stroke(); ctx.fillText(fx(v), L - 5, Y(v) + 4); }
    ctx.textAlign = "center"; [1, Math.round(o.n / 2), o.n].forEach(function (i) { ctx.fillText(i, X(i), H - 8); });
    ctx.save(); ctx.beginPath(); ctx.rect(L, T, W - L - R, H - T - B); ctx.clip();
    ctx.fillStyle = css("--accent"); ctx.globalAlpha = 0.13; ctx.beginPath();
    o.ks.forEach(function (i, j) { var y = Y(o.center(i) + 2 * o.spread(i)); j ? ctx.lineTo(X(i), y) : ctx.moveTo(X(i), y); });
    for (var j = o.ks.length - 1; j >= 0; j--) ctx.lineTo(X(o.ks[j]), Y(o.center(o.ks[j]) - 2 * o.spread(o.ks[j])));
    ctx.fill(); ctx.globalAlpha = 1;
    ctx.setLineDash([5, 4]); ctx.strokeStyle = css("--ink"); ctx.beginPath();
    o.ks.forEach(function (i, j) { var y = Y(o.center(i)); j ? ctx.lineTo(X(i), y) : ctx.moveTo(X(i), y); }); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = css("--accent"); ctx.lineWidth = 1.2; ctx.globalAlpha = 0.75;
    o.paths.forEach(function (p) { ctx.beginPath(); var first = true; for (var q = 0; q < o.ks.length && o.ks[q] <= kmax; q++) { var i = o.ks[q], yy = Y(p[i - 1]); first ? ctx.moveTo(X(i), yy) : ctx.lineTo(X(i), yy); first = false; } ctx.stroke(); });
    ctx.restore();
  }
  function frame(now) { reveal = reduce ? 1 : Math.min(1, (now - t0) / 3000); plots.forEach(function (o) { drawPaths(o, reveal); }); anim = reveal < 1 ? requestAnimationFrame(frame) : null; }
  function replay() { if (anim) cancelAnimationFrame(anim); t0 = performance.now(); anim = requestAnimationFrame(frame); }
  function buildPaths(P) {
    var M = makeModel(P.model, P.p), n = P.n, mp = Math.min(P.m, 30), s = Math.sqrt(M.sigma2), r = mulberry32(P.seed + 5 + (P.model === "bernoulli" ? 0 : 1)), raw = [], ks = [];
    for (var j = 0; j < mp; j++) raw.push(path(M, n, r));
    for (var i = 1; i <= n; i += (i < 100 ? 1 : Math.ceil(n / 1500))) ks.push(i); if (ks[ks.length - 1] !== n) ks.push(n);
    var q = [
      { id: "total", f: function (S) { return S; }, c: function (k) { return k * M.mu; }, sp: function (k) { return s * Math.sqrt(k); } },
      { id: "avg", f: function (S, k) { return S / k; }, c: function () { return M.mu; }, sp: function (k) { return s / Math.sqrt(k); } },
      { id: "norm", f: function (S, k) { return S / Math.sqrt(k); }, c: function (k) { return M.mu * Math.sqrt(k); }, sp: function () { return s; } }
    ];
    plots = q.map(function (qq) {
      var paths = raw.map(function (S) { return S.map(function (v, i) { return qq.f(v, i + 1); }); });
      var y0 = Infinity, y1 = -Infinity;
      if (qq.id === "avg") { y0 = M.mu - 0.5; y1 = M.mu + 0.5; }
      else { paths.forEach(function (p) { ks.forEach(function (i) { var v = p[i - 1]; if (v < y0) y0 = v; if (v > y1) y1 = v; }); }); ks.forEach(function (k) { y0 = Math.min(y0, qq.c(k) - 2 * qq.sp(k)); y1 = Math.max(y1, qq.c(k) + 2 * qq.sp(k)); }); }
      return { cv: $("tr-" + qq.id), n: n, ks: ks, paths: paths, y0: y0, y1: y1, center: qq.c, spread: qq.sp };
    });
    replay();
  }

  // ---------- histograms for increasing n ----------
  function hist(cv, tot, n, M, qi, axis) {
    cv.width = 260; cv.height = 150;
    var ctx = setup(cv), W = 260, H = 150, L = 8, R = 8, T = 22, B = 22, lo = axis[0], hi = axis[1];
    var scale = qi === 0 ? 1 : qi === 1 ? n : Math.sqrt(n), h = M.h / scale, base = (M.name === "bernoulli" ? 0 : -n) / scale, x0 = base - h / 2;
    var w = h * Math.max(1, Math.ceil((hi - lo) / 60 / h)), counts = {}, top = 0;
    for (var j = 0; j < tot.length; j++) { var b = Math.floor((tot[j] / scale - x0) / w + 1e-9); counts[b] = (counts[b] || 0) + 1; }
    var mu = qi === 0 ? n * M.mu : qi === 1 ? M.mu : M.mu * Math.sqrt(n), vr = qi === 0 ? n * M.sigma2 : qi === 1 ? M.sigma2 / n : M.sigma2;
    Object.keys(counts).forEach(function (b) { var xl = x0 + b * w; if (xl + w >= lo && xl <= hi) top = Math.max(top, counts[b] / (tot.length * w)); });
    top = Math.max(top, phi(mu, mu, vr)) * 1.1;
    var X = function (x) { return L + (x - lo) / (hi - lo) * (W - L - R); }, Y = function (d) { return H - B - d / top * (H - B - T); };
    ctx.fillStyle = css("--accent"); ctx.globalAlpha = 0.8;
    Object.keys(counts).forEach(function (b) { var xl = x0 + b * w, d = counts[b] / (tot.length * w); if (xl + w >= lo && xl <= hi) { var xa = Math.max(X(xl), L), xb = Math.min(X(xl + w), W - R); ctx.fillRect(xa, Y(d), Math.max(1, xb - xa - 0.5), H - B - Y(d)); } });
    ctx.globalAlpha = 1; ctx.strokeStyle = css("--ink"); ctx.lineWidth = 1.5; ctx.beginPath();
    for (var px = 0; px <= 120; px++) { var x = lo + (hi - lo) * px / 120, yy = Y(phi(x, mu, vr)); px ? ctx.lineTo(X(x), yy) : ctx.moveTo(X(x), yy); }
    ctx.stroke(); ctx.strokeStyle = css("--line"); ctx.beginPath(); ctx.moveTo(L, H - B); ctx.lineTo(W - R, H - B); ctx.stroke();
    ctx.fillStyle = css("--muted"); ctx.textAlign = "left"; ctx.fillText(fx(lo), L, H - 8); ctx.textAlign = "right"; ctx.fillText(fx(hi), W - R, H - 8);
    ctx.textAlign = "center"; ctx.fillText(fx(mu), X(mu), H - 8); ctx.textAlign = "left"; ctx.fillStyle = css("--ink"); ctx.fillText("n = " + n, L, 13);
  }
  function distributions(P) {
    var M = makeModel(P.model, P.p), s = Math.sqrt(M.sigma2), n = P.n;
    var cps = [0.001, 0.01, 0.1, 1].map(function (f) { return Math.max(1, Math.round(n * f)); }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var tot = sampleTotals(M, cps, P.m, P.seed + (P.model === "bernoulli" ? 0 : 100));
    (function () {
      var nn = cps[cps.length - 1], a = tot[cps.length - 1], TT = theory(M, nn), mS = mean(a);
      var vS = variance(a), vA = variance(a.map(function (v) { return v / nn; })), vN = variance(a.map(function (v) { return v / Math.sqrt(nn); }));
      var line = function (mm, me, vv, vt) { return "At n = " + nn + ": sample mean " + fx(mm) + " (expected " + fx(me) + "), sample variance " + fx(vv) + " (theory " + fx(vt) + ")."; };
      $("st-total").textContent = line(mS, TT.total.mean, vS, TT.total.var);
      $("st-avg").textContent = line(mS / nn, TT.average.mean, vA, TT.average.var);
      $("st-norm").textContent = line(mS / Math.sqrt(nn), TT.normalized.mean, vN, TT.normalized.var);
      S.dist = { n: nn, vS: vS, vST: TT.total.var, mA: mS / nn, vA: vA, vAT: TT.average.var, mN: mS / Math.sqrt(nn), mNT: TT.normalized.mean, vN: vN, vNT: TT.normalized.var };
    })();
    ["total", "avg", "norm"].forEach(function (id, qi) {
      var box = $("dg-" + id); box.innerHTML = "";
      cps.forEach(function (c, ci) {
        var cv = document.createElement("canvas"); box.appendChild(cv);
        var axis = qi === 0 ? [c * M.mu - 4 * s * Math.sqrt(c), c * M.mu + 4 * s * Math.sqrt(c)] : qi === 1 ? [M.mu - 0.5, M.mu + 0.5] :
          P.model === "rademacher" ? [-4, 4] : [-2, M.mu * Math.sqrt(n) + 4 * s];
        hist(cv, tot[ci], c, M, qi, axis);
      });
    });
    var sim = [[], [], []], th = [[], [], []];
    cps.forEach(function (c, i) {
      var a = tot[i], T = theory(M, c);
      sim[0].push([c, variance(a)]); sim[1].push([c, variance(a.map(function (v) { return v / c; }))]); sim[2].push([c, variance(a.map(function (v) { return v / Math.sqrt(c); }))]);
      th[0].push([c, T.total.var]); th[1].push([c, T.average.var]); th[2].push([c, T.normalized.var]);
    });
    var cols = [css("--accent"), AMBER, css("--ink")], names = ["Var(Sₙ)", "Var(Sₙ/n)", "Var(Sₙ/√n)"], all = [];
    sim.concat(th).forEach(function (a) { a.forEach(function (q) { all.push(q[1]); }); });
    var series = [];
    names.forEach(function (nm, i) { series.push({ name: nm, color: cols[i], pts: th[i], line: true, dash: [6, 4] }); series.push({ name: "", color: cols[i], pts: sim[i], dots: true }); });
    series = series.filter(function (s2) { return s2.name || true; });
    var lo = Math.pow(10, Math.floor(Math.log10(Math.min.apply(null, all)))), hi = Math.pow(10, Math.ceil(Math.log10(Math.max.apply(null, all))));
    var legendSeries = names.map(function (nm, i) { return { name: nm, color: cols[i], pts: [], line: false }; });
    logPlot($("d-var"), { x0: Math.pow(10, Math.floor(Math.log10(cps[0]))), x1: Math.pow(10, Math.ceil(Math.log10(cps[cps.length - 1]))), y0: lo, y1: hi, xlabel: "n", series: series.filter(function (s2) { return s2.pts.length; }).concat(legendSeries) });
  }

  // ---------- law of large numbers ----------
  var LC = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000], lln = null;
  function llnRender() {
    var eps = Math.max(0.005, Math.min(0.5, Number($("eps").value) || 0.05)), cps = lln.cps;
    var rows = cps.map(function (n, i) { return llnRow(lln.M, n, lln.tot[i], eps); });
    var lr = rows[rows.length - 1]; S.lln = { n: lr.n, emp: lr.empirical, cheb: lr.chebyshev, eps: eps };
    if (S.ready) renderSummary();
    logPlot($("l-chart"), { x0: 10, x1: 10000, y0: 1e-4, y1: 1, xlabel: "n",
      series: [
        { name: "Chebyshev bound", color: AMBER, pts: rows.map(function (r) { return [r.n, r.chebyshev]; }), line: true, dash: [6, 4] },
        { name: "Hoeffding bound", color: css("--ink"), pts: rows.map(function (r) { return [r.n, r.hoeffding]; }), line: true, dash: [2, 3] },
        { name: "Simulated", color: css("--accent"), pts: rows.map(function (r) { return [r.n, r.empirical]; }), line: true, dots: true }] });
  }
  function llnRun(P) {
    var M = makeModel(P.model, P.p), cps = LC.filter(function (v) { return v <= P.n; });
    lln = { M: M, cps: cps, tot: sampleTotals(M, cps, P.m, P.seed + 1 + (P.model === "bernoulli" ? 0 : 100)) };
    llnRender();
  }

  // ---------- central limit theorem (selected model, standardized) ----------
  function ecdfPlot(cv, curves) {
    var ctx = setup(cv), W = cv.width, H = cv.height, L = 44, R = 12, T = 12, B = 34, x0 = -3.5, x1 = 3.5;
    var X = function (x) { return L + (x - x0) / (x1 - x0) * (W - L - R); }, Y = function (y) { return T + (1 - y) * (H - T - B); };
    ctx.strokeStyle = css("--line"); ctx.fillStyle = css("--muted"); ctx.lineWidth = 1; ctx.textAlign = "right";
    [0, 0.25, 0.5, 0.75, 1].forEach(function (y) { ctx.beginPath(); ctx.moveTo(L, Y(y)); ctx.lineTo(W - R, Y(y)); ctx.stroke(); ctx.fillText(y, L - 5, Y(y) + 4); });
    ctx.textAlign = "center"; for (var x = -3; x <= 3; x++) { ctx.beginPath(); ctx.moveTo(X(x), T); ctx.lineTo(X(x), H - B); ctx.stroke(); ctx.fillText(x, X(x), H - B + 14); }
    ctx.fillText("standardized score", (L + W - R) / 2, H - 6);
    curves.forEach(function (c) {
      ctx.strokeStyle = c.color; ctx.lineWidth = 2; ctx.setLineDash(c.dash || []); ctx.beginPath();
      for (var px = 0; px <= 400; px++) {
        var xx = x0 + (x1 - x0) * px / 400, F;
        if (c.z) { var lo = 0, hi = c.z.length; while (lo < hi) { var mid = (lo + hi) >> 1; if (c.z[mid] <= xx) lo = mid + 1; else hi = mid; } F = lo / c.z.length; } else F = Phi(xx);
        px ? ctx.lineTo(X(xx), Y(F)) : ctx.moveTo(X(xx), Y(F));
      }
      ctx.stroke(); ctx.setLineDash([]);
    });
    ctx.textAlign = "left"; curves.forEach(function (c, i) { var yy = H - B - 14 - (curves.length - 1 - i) * 16; ctx.fillStyle = c.color; ctx.fillRect(W - R - 90, yy - 4, 14, 4); ctx.fillStyle = css("--ink"); ctx.fillText(c.name, W - R - 70, yy); });
  }
  function cltRun(P) {
    var cc = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000], M = makeModel(P.model, P.p), mm = 10 * P.m, sg = Math.sqrt(M.sigma2);
    var tot = sampleTotals(M, cc, mm, P.seed + 3);
    var z = cc.map(function (n, i) { return Float64Array.from(tot[i], function (v) { return (v - n * M.mu) / (sg * Math.sqrt(n)); }).sort(); });
    var D = z.map(function (zz) { return ksNormal(zz); }), noise = 1.36 / Math.sqrt(mm), floor = function (n) { return 0.1995 * M.h / (sg * Math.sqrt(n)); };
    var shades = ["#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#15803d"], pick = [0, 2, 4, 6, 9];
    ecdfPlot($("c-cdf"), [{ name: "Φ", color: css("--ink"), dash: [5, 4] }].concat(pick.map(function (i, k) { return { name: "n = " + cc[i], color: shades[k], z: z[i] }; })));
    logPlot($("c-chart"), { x0: 1, x1: 1000, y0: 0.005, y1: 1, xlabel: "n",
      series: [
        { name: "Sampling noise (5% critical value)", color: css("--ink"), pts: [[1, noise], [1000, noise]], line: true, dash: [2, 3] },
        { name: "Lattice floor", color: AMBER, pts: cc.map(function (n) { return [n, floor(n)]; }), line: true, dash: [6, 4] },
        { name: "Simulated Dₙ", color: css("--accent"), pts: cc.map(function (n, i) { return [n, D[i]]; }), line: true, dots: true }] });
    $("c-info").textContent = mm + " attackers for each n; critical value 1.36/√" + mm + " = " + noise.toFixed(4) + ".";
    S.clt = { n: cc[cc.length - 1], D: D[D.length - 1] };
  }

  // ---------- systems and attackers ----------
  function aggRun(P) {
    var M = makeModel(P.model, P.p), GN = [10, 100, 1000], GM = [1, 10, 100], sim = [], th = [], mi = P.model === "bernoulli" ? 0 : 1;
    GN.forEach(function (n, ni) { GM.forEach(function (m, k) { var a = aggregate(M, n, m, 200, P.seed + 40 + 10 * ni + k + 100 * mi); sim.push([n * m, a.sd]); }); });
    var sg = Math.sqrt(M.sigma2);
    logPlot($("g-chart"), { x0: 10, x1: 100000, y0: 0.001, y1: 1, xlabel: "m · n",
      series: [{ name: "Theory σ/√(mn)", color: css("--ink"), pts: [[10, sg / Math.sqrt(10)], [100000, sg / Math.sqrt(100000)]], line: true, dash: [6, 4] },
               { name: "Simulated", color: css("--accent"), pts: sim, dots: true }] });
  }

  function renderSummary() {
    var P = S.P, M = makeModel(P.model, P.p), d = S.dist, l = S.lln, c = S.clt, bern = P.model === "bernoulli";
    var li = function (t, x) { return "<li><strong>" + t + ".</strong> " + x + "</li>"; };
    $("runSummary").innerHTML =
      li("Setup", (bern ? "Bernoulli with p = " + P.p : "Rademacher") + ", n = " + P.n + " systems, m = " + P.m + " attackers, seed " + P.seed + ".") +
      li("Total score", "At n = " + d.n + " the sample variance of Sₙ is " + fx(d.vS) + " against the theoretical " + fx(d.vST) + ".") +
      li("Average score", "The sample mean of Sₙ/n is " + fx(d.mA) + " (expected " + fx(M.mu) + ") and its variance " + fx(d.vA) + " (theory " + fx(d.vAT) + ").") +
      li("Normalized score", "The sample variance of Sₙ/√n is " + fx(d.vN) + " (theory " + fx(d.vNT) + ")" + (bern ? ", while its mean " + fx(d.mN) + " follows p√n = " + fx(d.mNT) + ": it drifts." : ", and its mean " + fx(d.mN) + " is close to 0.")) +
      li("Law of large numbers", "At n = " + l.n + " the share of attackers with |Sₙ/n − μ| &gt; " + l.eps + " is " + l.emp.toFixed(3) + " (Chebyshev bound " + l.cheb.toFixed(3) + ").") +
      li("Central limit theorem", "The Kolmogorov distance between the " + (bern ? "standardized Bernoulli score" : "normalized Rademacher score") + " and N(0, 1) at n = " + c.n + " is " + c.D.toFixed(4) + ".");
  }
  function runAll() {
    var P = params(), t1 = performance.now(); S.P = P; S.ready = false;
    document.querySelector("main").setAttribute("data-model", P.model);
    $("runStatus").textContent = "Simulating…";
    setTimeout(function () { buildPaths(P); distributions(P);
      setTimeout(function () { llnRun(P);
        setTimeout(function () { cltRun(P); setTimeout(function () { aggRun(P); S.ready = true; renderSummary(); $("runStatus").textContent = "Done in " + ((performance.now() - t1) / 1000).toFixed(1) + " s."; }, 15); }, 15); }, 15); }, 15);
  }
  $("runBtn").addEventListener("click", runAll);
  $("replay").addEventListener("click", replay);
  ["modelSel", "n", "m", "p", "seed"].forEach(function (id) { $(id).addEventListener("change", runAll); });
  $("eps").addEventListener("input", function () { if (lln) llnRender(); });
  if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", runAll);
  runAll();
})();
