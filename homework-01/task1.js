(function () {
  var $ = function (id) { return document.getElementById(id); };
  function run() {
    var g = { x: Number($("t1-gx").value), y: Number($("t1-gy").value) };
    var k = Number($("t1-k").value);
    $("t1-msg").textContent = "";
    $("t1-steps").innerHTML = "";
    $("t1-pubkey").textContent = "–";
    if (!Number.isInteger(g.x) || !Number.isInteger(g.y) || g.x < 0 || g.x >= P || g.y < 0 || g.y >= P) {
      $("t1-msg").textContent = "G needs whole-number coordinates between 0 and " + (P - 1) + ".";
      return;
    }
    if (!isOnCurve(g)) { $("t1-msg").textContent = "G = " + fmt(g) + " is not on the curve."; return; }
    if (!Number.isInteger(k) || k < 1 || k > 100) { $("t1-msg").textContent = "k needs to be a whole number between 1 and 100."; return; }
    var steps = scalarMulSteps(k, g);
    $("t1-steps").innerHTML = steps.map(function (pt, i) {
      return '<li style="animation-delay:' + Math.min(i * 90, 1200) + 'ms"><b>' + (i + 1) + "G</b>" + fmt(pt) +
        (isOnCurve(pt) ? ' <em class="ok">✓</em>' : ' <em class="bad">not on curve</em>') + "</li>";
    }).join("");
    $("t1-pubkey").textContent = fmt(steps[steps.length - 1]);
  }
  $("t1-run").addEventListener("click", run);
  run();
})();
