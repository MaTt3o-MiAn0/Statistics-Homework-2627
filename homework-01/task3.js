(function () {
  var $ = function (id) { return document.getElementById(id); };
  var BITS = 5, points = allPoints();
  function bitsOf(v) { var o = []; for (var i = BITS - 1; i >= 0; i--) o.push((v >> i) & 1); return o; }
  function encode(pt) { return bitsOf(pt.x).concat(bitsOf(pt.y)); }
  function ham(a, b) { var d = 0; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; }
  function pearson(a, b) {
    var n = a.length, ma = a.reduce(function (s, v) { return s + v; }, 0) / n, mb = b.reduce(function (s, v) { return s + v; }, 0) / n, sab = 0, saa = 0, sbb = 0;
    for (var i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += Math.pow(a[i] - ma, 2); sbb += Math.pow(b[i] - mb, 2); }
    return saa === 0 || sbb === 0 ? NaN : sab / Math.sqrt(saa * sbb);
  }
  function num(v, d) { return isNaN(v) ? "n/a" : v.toFixed(d === undefined ? 3 : d); }
  function chart(title, counts) {
    var max = Math.max.apply(null, counts.concat([1]));
    return '<div class="chart"><h4>' + title + '</h4><div class="vbars">' + counts.map(function (c, v) {
      return '<div class="vb" title="' + v + ": " + c + '"><b>' + (c || "") + '</b><span style="height:' + Math.round(c / max * 100) + '%"></span><i>' + v + "</i></div>";
    }).join("") + "</div></div>";
  }

  function run() {
    var g = points[Number($("t3-g").value)], K = Math.floor(Number($("t3-K").value));
    $("t3-msg").textContent = "";
    var ord = orderOf(g);
    var sub = scalarMulSteps(ord - 1, g);
    $("t3-subgroup").innerHTML = "<tbody><tr><td>k</td>" + sub.map(function (q, i) { return "<td>" + (i + 1) + "</td>"; }).join("") +
      "</tr><tr><td>Q = kG</td>" + sub.map(function (q) { return "<td>" + fmt(q) + "</td>"; }).join("") +
      "</tr><tr><td>X (binary)</td>" + sub.map(function (q) { return "<td>" + q.x.toString(2).padStart(5, "0") + "</td>"; }).join("") +
      "</tr><tr><td>Y (binary)</td>" + sub.map(function (q) { return "<td>" + q.y.toString(2).padStart(5, "0") + "</td>"; }).join("") + "</tr></tbody>";
    if (!Number.isInteger(K) || K < 1 || K > 2000) { $("t3-msg").textContent = "K must be a whole number between 1 and 2000."; return; }

    var all = scalarMulSteps(K, g), ks = [], xs = [], ys = [], freq = {}, inf = 0;
    all.forEach(function (q, i) {
      if (q === INF) { inf++; return; }
      ks.push(i + 1); xs.push(q.x); ys.push(q.y); freq[fmt(q)] = (freq[fmt(q)] || 0) + 1;
    });
    var n = xs.length;
    if (!n) { $("t3-msg").textContent = "Every multiple is INF for this G."; return; }
    var hx = new Array(P).fill(0), hy = new Array(P).fill(0), ones = new Array(2 * BITS).fill(0);
    for (var i = 0; i < n; i++) { hx[xs[i]]++; hy[ys[i]]++; encode({ x: xs[i], y: ys[i] }).forEach(function (b, j) { ones[j] += b; }); }

    var kBits = Math.floor(Math.log2(K)) + 1, fs = 0, fc = 0, ns = 0, nc = 0;
    for (var k = 1; k <= K; k++) {
      var q = scalarMulFast(k, g); if (q === INF) continue;
      var e = encode(q);
      for (var j = 0; j < kBits; j++) {
        var k2 = k ^ (1 << j); if (k2 < 1) continue;
        var q2 = scalarMulFast(k2, g); if (q2 === INF) continue;
        fs += ham(e, encode(q2)); fc++;
      }
      var q3 = scalarMulFast(k + 1, g); if (q3 !== INF) { ns += ham(e, encode(q3)); nc++; }
    }
    var bitHead = "", bx = "", by = "";
    for (var b = 0; b < BITS; b++) { bitHead += "<th>bit " + (BITS - 1 - b) + "</th>"; bx += "<td>" + num(ones[b] / n, 2) + "</td>"; by += "<td>" + num(ones[BITS + b] / n, 2) + "</td>"; }
    var freqChips = Object.keys(freq).map(function (p) { return "<li><b>" + p + "</b>" + freq[p] + "×</li>"; }).join("");

    $("t3-results").innerHTML =
      "<h3>Results for G = " + fmt(g) + ", k = 1…" + K + "</h3>" +
      "<p>Order of G: " + ord + ". The point at infinity appeared " + inf + " times; the other " + n + " points include " + Object.keys(freq).length + " different ones.</p>" +
      '<div class="grid2">' + chart("Values of x", hx) + chart("Values of y", hy) + "</div>" +
      "<h4>How often each point appears</h4><ul class=\"chips\">" + freqChips + "</ul>" +
      '<div class="grid2"><div><h4>Share of bits equal to 1 (0.50 = balanced)</h4><div class="table-wrap"><table class="t-compact"><thead><tr><th></th>' + bitHead + "</tr></thead><tbody><tr><td>x</td>" + bx + "</tr><tr><td>y</td>" + by + "</tr></tbody></table></div></div>" +
      '<div><h4>Correlations and avalanche</h4><ul>' +
      "<li>Pearson correlation: k–x " + num(pearson(ks, xs)) + ", k–y " + num(pearson(ks, ys)) + ", x–y " + num(pearson(xs, ys)) + "</li>" +
      "<li>Flip one bit of k: " + num(fs / fc, 2) + " of 10 output bits change (" + num(fs / fc / 10) + ")</li>" +
      "<li>k → k + 1: " + num(ns / nc, 2) + " of 10 output bits change (" + num(ns / nc / 10) + ")</li>" +
      "<li>Reference: a good hash changes about half of the bits.</li></ul></div></div>";
  }
  points.forEach(function (p, i) {
    var o = document.createElement("option"); o.value = i; o.textContent = fmt(p);
    if (p.x === G.x && p.y === G.y) o.selected = true; $("t3-g").appendChild(o);
  });
  $("t3-orders").innerHTML = points.map(function (p) { return "<li><b>" + fmt(p) + "</b>order " + orderOf(p) + "</li>"; }).join("");
  $("t3-run").addEventListener("click", run);
  $("t3-g").addEventListener("change", run);
  run();
})();
