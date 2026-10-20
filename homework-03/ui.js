(function () {
  var $ = function (id) { return document.getElementById(id); };
  var enc = new TextEncoder(), dec = new TextDecoder();
  var hex = function (n) { return n.toString(16).padStart(64, "0"); };
  function chart(title, values, labels, opts) {
    opts = opts || {};
    var max = Math.max.apply(null, values.concat([1e-9]));
    return '<div class="chart"><h4>' + title + '</h4><div class="vbars">' + values.map(function (v, i) {
      return '<div class="vb' + (i === opts.best ? " best" : "") + '" title="' + labels[i] + ": " + (opts.fmt ? opts.fmt(v) : v) + '">' +
        (opts.values === false ? "" : "<b>" + (opts.fmt ? opts.fmt(v) : (v || "")) + "</b>") +
        '<span style="height:' + Math.round(v / max * 100) + '%"></span><i>' + labels[i] + "</i></div>";
    }).join("") + "</div></div>";
  }
  var LET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  // ---------- Task 1: toy ECC scheme ----------
  var st = { keys: null, enc: null, prev: null, bits: 16 };
  function genKeys() {
    st.bits = Number($("e-bits").value); st.keys = generateKeys(st.bits); st.enc = null; st.prev = null;
    $("e-d").textContent = st.keys.d.toString() + " (0x" + st.keys.d.toString(16) + ")";
    $("e-Qx").textContent = hex(st.keys.Q.x); $("e-Qy").textContent = hex(st.keys.Q.y);
    ["e-C1x", "e-C1y", "e-C2", "e-Sx", "e-plain"].forEach(function (id) { $(id).textContent = "–"; });
    $("e-msg").textContent = "Key pair generated: d is a " + st.bits + "-bit number.";
  }
  function doEncrypt() {
    if (!st.keys) genKeys();
    var e = encrypt(enc.encode($("msg").value), st.keys.Q), c2 = toHex(e.C2);
    $("e-msg").textContent = st.prev === null ? "Encrypted with a fresh ephemeral key r." :
      (st.prev === c2 ? "Same ciphertext as before." : "New ciphertext: different from the previous one, although the message is the same.");
    st.prev = c2; st.enc = e;
    $("e-C1x").textContent = hex(e.C1.x); $("e-C1y").textContent = hex(e.C1.y); $("e-C2").textContent = c2; $("e-Sx").textContent = hex(e.S.x);
    $("e-plain").textContent = "–";
  }
  function doDecrypt() {
    if (!st.enc) { $("e-msg").textContent = "Encrypt first."; return; }
    var m = dec.decode(decrypt(st.enc.C1, st.enc.C2, st.keys.d));
    $("e-plain").textContent = m; $("e-msg").textContent = m === $("msg").value ? "Decrypted message equal to the original ✓" : "The message was changed after encryption.";
  }
  $("e-gen").addEventListener("click", genKeys);
  $("e-enc").addEventListener("click", doEncrypt);
  $("e-dec").addEventListener("click", doDecrypt);
  $("e-bits").addEventListener("change", function () { st.keys = null; st.enc = null; genKeys(); });

  // ---------- Task 2: Caesar ----------
  var lastCipher = "";
  function caesarUi() {
    var k = Math.min(25, Math.max(0, Math.floor(Number($("c-key").value)) || 0)), m = $("msg").value;
    lastCipher = caesarEncrypt(m, k);
    $("c-cipher").textContent = lastCipher; $("c-plain").textContent = caesarDecrypt(lastCipher, k);
    $("c-alpha").innerHTML = "<tbody><tr><th>plain</th>" + LET.map(function (l) { return "<td>" + l + "</td>"; }).join("") +
      "</tr><tr><th>cipher</th>" + LET.map(function (l, i) { return "<td>" + LET[(i + k) % 26] + "</td>"; }).join("") + "</tr></tbody>";
  }
  $("c-key").addEventListener("input", caesarUi);
  $("msg").addEventListener("input", function () { caesarUi(); st.enc = null; });

  // ---------- Task 3: statistics ----------
  (function () {
    var plain = TEST_TEXT.slice(0, 2000), cip = caesarEncrypt(plain, 7);
    var cp = letterCounts(plain), cc = letterCounts(cip);
    var Q = SECP.mul(0xABCDn, SECP.G), e = encrypt(enc.encode(plain), Q, 123456789012345678901234567890n);
    var cb = new Array(256).fill(0); e.C2.forEach(function (b) { cb[b]++; });
    var sp = symbolStats(cp), sc = symbolStats(cc), sb = symbolStats(cb);
    var top = function (c) { return LET[c.indexOf(Math.max.apply(null, c))]; };
    var row = function (name, s, sym, max, topSym) {
      return "<tr><td>" + name + "</td><td>" + s.n + " " + sym + "</td><td>" + s.H.toFixed(3) + " / " + max + "</td><td>" + s.ic.toFixed(4) + "</td><td>" + (s.top * 100).toFixed(2) + "%" + (topSym ? " (" + topSym + ")" : "") + "</td></tr>";
    };
    $("s-table").innerHTML = "<thead><tr><th>Text</th><th>Sample</th><th>Entropy (bits / maximum)</th><th>Index of coincidence</th><th>Most frequent symbol</th></tr></thead><tbody>" +
      row("Plaintext", sp, "letters", "4.700", top(cp)) + row("Caesar ciphertext", sc, "letters", "4.700", top(cc)) + row("ECC ciphertext", sb, "bytes", "8.000", "") + "</tbody>";
    $("s-chart1").innerHTML = chart("Caesar ciphertext: letter counts", cc, LET, { values: false });
    var bins = new Array(32).fill(0); cb.forEach(function (c, v) { bins[v >> 3] += c; });
    $("s-chart2").innerHTML = chart("ECC ciphertext: byte values in 32 groups of 8", bins, bins.map(function (_, i) { return i * 8; }), { values: false });
  })();

  // ---------- Task 4: attack on Caesar ----------
  function runAttack() {
    var t = $("a-text").value, r = attack(t);
    if (!r) { $("a-msg").textContent = "The text contains no letters."; $("a-out").innerHTML = ""; return; }
    $("a-msg").textContent = r.n < 30 ? "Only " + r.n + " letters: the result is not reliable." : "";
    $("a-out").innerHTML = '<p class="result">Recovered key: <output>' + r.key + "</output> · letters used: " + r.n + " · confidence ratio (second-best χ² / best χ²): " + r.ratio.toFixed(2) + "</p>" +
      '<div class="grid2">' + chart("Letter counts in the ciphertext", r.counts, LET, { values: false }) +
      chart("χ² for each candidate key (the lowest wins)", r.chi, r.chi.map(function (_, i) { return i; }), { best: r.key, values: false, fmt: function (v) { return v.toFixed(0); } }) + "</div>" +
      '<p class="out">' + caesarDecrypt(t, r.key).slice(0, 400).replace(/</g, "&lt;") + (t.length > 400 ? " …" : "") + "</p>";
  }
  $("a-text").value = caesarEncrypt(TEST_TEXT.slice(20000, 20300), 11);
  $("a-run").addEventListener("click", runAttack);
  $("a-use").addEventListener("click", function () { $("a-text").value = lastCipher; runAttack(); });
  (function () {
    var rows = lengthExperiment([5, 10, 15, 20, 30, 50, 100, 200, 500], 500, 2026);
    $("x-out").innerHTML = chart("Success rate of the attack (%) by ciphertext length (letters)", rows.map(function (r) { return +(r.rate * 100).toFixed(1); }), rows.map(function (r) { return r.L; }), { fmt: function (v) { return v; } });
  })();

  // ---------- Task 5: brute force on the toy ECC key ----------
  function fmtTime(s) {
    if (s < 1e-3) return "under 1 ms"; if (s < 1) return (s * 1000).toFixed(0) + " ms"; if (s < 60) return s.toFixed(1) + " s";
    if (s < 3600) return (s / 60).toFixed(1) + " minutes"; if (s < 86400) return (s / 3600).toFixed(1) + " hours";
    if (s < 3.156e7) return (s / 86400).toFixed(1) + " days"; var y = s / 3.156e7;
    return y < 1e6 ? y.toFixed(0) + " years" : y.toExponential(1).replace("e+", " × 10^") + " years";
  }
  function runBrute() {
    if (!st.keys) genKeys();
    if (!st.enc) doEncrypt();
    var bits = st.bits, total = Math.pow(2, bits), s = bruteForceStart(st.keys.Q), t0 = performance.now();
    $("b-run").disabled = true; $("b-out").innerHTML = ""; $("b-msg").textContent = "Searching…";
    (function tick() {
      bruteForceChunk(s, 3000);
      $("b-prog").style.width = Math.min(100, s.k / total * 100) + "%";
      if (s.found === null) { setTimeout(tick, 0); return; }
      var ms = performance.now() - t0, rate = s.k / (ms / 1000), m = dec.decode(decrypt(st.enc.C1, st.enc.C2, s.found));
      $("b-run").disabled = false; $("b-msg").textContent = "";
      $("b-out").innerHTML = "<dt>Found d</dt><dd>" + s.found + "</dd><dt>Equal to the real d?</dt><dd>" + (s.found === st.keys.d ? "yes" : "no") + "</dd>" +
        "<dt>Candidates tried</dt><dd>" + s.k + " out of " + total + "</dd><dt>Time</dt><dd>" + ms.toFixed(0) + " ms (" + Math.round(rate).toLocaleString("en-US") + " candidates per second)</dd>" +
        "<dt>Decrypted</dt><dd>" + m.replace(/</g, "&lt;") + "</dd>";
      $("b-table").innerHTML = "<thead><tr><th>Key size N (bits)</th><th>Average candidates 2^(N−1)</th><th>Estimated time</th></tr></thead><tbody>" +
        [16, 20, 32, 48, 64, 128, 256].map(function (n) {
          var c = Math.pow(2, n - 1); return "<tr><td>" + n + "</td><td>" + c.toExponential(2).replace("e+", " × 10^") + "</td><td>" + fmtTime(c / rate) + "</td></tr>";
        }).join("") + "</tbody>";
    })();
  }
  $("b-run").addEventListener("click", runBrute);

  genKeys(); caesarUi();
})();
