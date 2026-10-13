(function () {
  var T = function (id) { return document.getElementById(id); };
  var E = window.ethers;
  var PHRASE = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  var PATH = "44'/60'/0'/0/0", REF = "0x9858EfFD232B4033E47d90003D41EC34EcaEda94";
  var results = [], shown = 0, timer = null;
  var chips = Array.prototype.slice.call(document.querySelectorAll("#stages span"));

  function compute(pass) {
    var seed = E.Mnemonic.fromPhrase(PHRASE, pass).computeSeed();
    var master = E.HDNodeWallet.fromSeed(seed), child = master.derivePath(PATH);
    var pub = E.SigningKey.computePublicKey(child.privateKey, false);
    var hash = E.keccak256("0x" + pub.slice(4)), lower = "0x" + hash.slice(-40);
    var chk = E.keccak256(E.toUtf8Bytes(lower.slice(2)));
    return [
      ["BIP-39: mnemonic and passphrase to a 512-bit seed (PBKDF2-HMAC-SHA512, 2048 rounds)", [seed]],
      ["BIP-32: HMAC-SHA512 of the seed gives the master private key and the chain code", [master.privateKey, master.chainCode]],
      ["BIP-44: child derivation along m/" + PATH + " gives the Ethereum private key", [child.privateKey]],
      ["secp256k1: public key Q = kG, uncompressed (04, then X and Y)", [pub]],
      ["Keccak-256 of X and Y (64 bytes, without the 04 prefix); the last 20 bytes are the address", [hash, "address: " + lower]],
      ["EIP-55: the case of each letter follows the Keccak-256 hash of the lowercase address", [chk, "checksummed: " + E.getAddress(lower)]]
    ];
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } T("play").textContent = "Play"; }
  function render() {
    T("stepsOut").innerHTML = results.slice(0, shown).map(function (r, i) {
      return "<li><strong>Step " + (i + 1) + ".</strong> " + r[0] + r[1].map(function (l) { return "<code>" + l + "</code>"; }).join("") + "</li>";
    }).join("");
    chips.forEach(function (c, i) { c.className = i < shown ? (i === shown - 1 ? "done now" : "done") : ""; });
    T("prog").style.width = (shown / 6 * 100) + "%";
    var done = results.length && shown >= results.length;
    T("next").disabled = !!done;
    if (done) {
      stop();
      var addr = results[5][1][1].replace("checksummed: ", "");
      T("demomsg").textContent = T("pp").value === "" ? (addr === REF ? "The final address matches the known reference address for this test phrase." : "The final address does not match the reference.") : "Done. With a passphrase the wallet is different, so there is no reference to compare.";
    } else T("demomsg").textContent = "";
  }
  function restart() {
    stop();
    if (!E) { T("demomsg").textContent = "The ethers.js library could not be loaded (internet connection needed)."; return false; }
    results = compute(T("pp").value); shown = 0; render(); return true;
  }
  function next() { if (!results.length && !restart()) return; if (shown < results.length) shown++; render(); }
  T("next").addEventListener("click", next);
  T("restart").addEventListener("click", restart);
  T("pp").addEventListener("change", restart);
  T("play").addEventListener("click", function () {
    if (timer) return stop();
    if (!results.length || shown >= results.length) { if (!restart()) return; }
    T("play").textContent = "Pause"; next(); timer = setInterval(next, 1100);
  });

  // Keccak-256 avalanche experiment
  function pop(b) { var c = 0; while (b) { c += b & 1; b >>= 1; } return c; }
  function ham(a, b, from) { var d = 0; for (var i = from || 0; i < a.length; i++) d += pop(a[i] ^ b[i]); return d; }
  T("runAv").addEventListener("click", function () {
    if (!E) { T("avOut").textContent = "The ethers.js library could not be loaded (internet connection needed)."; return; }
    var priv = E.HDNodeWallet.fromSeed(E.Mnemonic.fromPhrase(PHRASE, "").computeSeed()).derivePath(PATH).privateKey;
    var pub = E.getBytes(E.SigningKey.computePublicKey(priv, false)).slice(1), h0 = E.getBytes(E.keccak256(pub));
    var d = [], d160 = [], ones = 0;
    for (var i = 0; i < 64; i++) {
      var m = pub.slice(); m[i] ^= 1 << (i % 8);
      var h = E.getBytes(E.keccak256(m));
      d.push(ham(h0, h)); d160.push(ham(h0.slice(12), h.slice(12)));
      h.forEach(function (b) { ones += pop(b); });
    }
    var avg = function (a) { return a.reduce(function (s, v) { return s + v; }, 0) / a.length; };
    var p = ones / (64 * 256), H = -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
    var lo = Math.floor(Math.min.apply(null, d) / 4) * 4, hi = Math.max.apply(null, d), bins = [], labels = [];
    for (var k = lo; k <= hi; k += 4) { labels.push(k + "–" + (k + 3)); bins.push(d.filter(function (v) { return v >= k && v < k + 4; }).length); }
    var max = Math.max.apply(null, bins);
    T("avOut").innerHTML = '<div class="split"><ul><li>Average changed bits of the 256-bit hash: <strong>' + avg(d).toFixed(2) + "</strong> (about 128 expected)</li>" +
      "<li>Average changed bits in the last 160 bits: <strong>" + avg(d160).toFixed(2) + "</strong> (about 80 expected)</li>" +
      "<li>Share of 1 bits in the 64 modified hashes: <strong>" + (p * 100).toFixed(2) + "%</strong> (about 50% expected)</li>" +
      "<li>Entropy of the 0/1 shares: <strong>" + H.toFixed(4) + "</strong> bits per bit (maximum 1)</li></ul>" +
      '<div class="chart"><h4>Changed bits per trial (64 trials)</h4><div class="vbars">' + bins.map(function (c, i) {
        return '<div class="vb"><b>' + (c || "") + '</b><span style="height:' + Math.round(c / max * 100) + '%"></span><i>' + labels[i].split("–")[0] + "</i></div>";
      }).join("") + "</div></div></div>";
  });
})();
