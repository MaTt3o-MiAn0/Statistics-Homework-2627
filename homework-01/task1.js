// Task 1: G, 2G, ..., kG and the toy public key.
(function () {
  const element = (id) => document.getElementById(id);

  function validationError(base, k) {
    const inRange = (value) => Number.isInteger(value) && value >= 0 && value < P;
    if (!inRange(base.x) || !inRange(base.y)) {
      return `G needs whole-number coordinates between 0 and ${P - 1}.`;
    }
    if (!isOnCurve(base)) {
      return `G = ${formatPoint(base)} is not on the curve.`;
    }
    if (!Number.isInteger(k) || k < 1 || k > 100) {
      return "k needs to be a whole number between 1 and 100.";
    }
    return "";
  }

  function run() {
    const base = { x: Number(element("t1-gx").value), y: Number(element("t1-gy").value) };
    const k = Number(element("t1-k").value);
    element("t1-steps").innerHTML = "";
    element("t1-pubkey").textContent = "–";
    element("t1-msg").textContent = validationError(base, k);
    if (element("t1-msg").textContent) {
      return;
    }

    const steps = multiplyStepByStep(k, base);
    element("t1-steps").innerHTML = steps
      .map((point, i) => {
        const delay = Math.min(i * 90, 1200);
        const check = isOnCurve(point)
          ? ' <em class="ok">✓</em>'
          : ' <em class="bad">not on curve</em>';
        return `<li style="animation-delay:${delay}ms"><b>${i + 1}G</b>${formatPoint(point)}${check}</li>`;
      })
      .join("");
    element("t1-pubkey").textContent = formatPoint(steps[steps.length - 1]);
  }

  element("t1-run").addEventListener("click", run);
  run();
})();
