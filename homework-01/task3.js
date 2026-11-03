// Task 3: statistics of the points kG for k = 1 ... K.
(function () {
  const element = (id) => document.getElementById(id);
  const BITS = 5; // coordinates go from 0 to 16
  const points = allPoints();

  function bitsOf(value) {
    const bits = [];
    for (let i = BITS - 1; i >= 0; i--) {
      bits.push((value >> i) & 1);
    }
    return bits;
  }

  // A point as 10 bits: 5 for x and 5 for y.
  const pointBits = (point) => bitsOf(point.x).concat(bitsOf(point.y));

  function hammingDistance(first, second) {
    let distance = 0;
    for (let i = 0; i < first.length; i++) {
      if (first[i] !== second[i]) {
        distance++;
      }
    }
    return distance;
  }

  function pearson(first, second) {
    const n = first.length;
    const meanFirst = first.reduce((sum, value) => sum + value, 0) / n;
    const meanSecond = second.reduce((sum, value) => sum + value, 0) / n;
    let product = 0;
    let squaresFirst = 0;
    let squaresSecond = 0;
    for (let i = 0; i < n; i++) {
      product += (first[i] - meanFirst) * (second[i] - meanSecond);
      squaresFirst += Math.pow(first[i] - meanFirst, 2);
      squaresSecond += Math.pow(second[i] - meanSecond, 2);
    }
    return squaresFirst === 0 || squaresSecond === 0
      ? NaN
      : product / Math.sqrt(squaresFirst * squaresSecond);
  }

  const fixed = (value, digits = 3) => (isNaN(value) ? "n/a" : value.toFixed(digits));

  // Table of all valid private keys with their public keys, in binary.
  function showSubgroup(base, order) {
    const multiples = multiplyStepByStep(order - 1, base);
    const row = (title, cell) =>
      `<tr><td>${title}</td>${multiples.map((point, i) => `<td>${cell(point, i)}</td>`).join("")}</tr>`;
    element("t3-subgroup").innerHTML =
      "<tbody>" +
      row("k", (point, i) => i + 1) +
      row("Q = kG", (point) => formatPoint(point)) +
      row("X (binary)", (point) => point.x.toString(2).padStart(5, "0")) +
      row("Y (binary)", (point) => point.y.toString(2).padStart(5, "0")) +
      "</tbody>";
  }

  // Average number of output bits that change when one bit of k flips, and when k becomes k + 1.
  function avalanche(base, K) {
    const keyBits = Math.floor(Math.log2(K)) + 1;
    let flipTotal = 0;
    let flipCount = 0;
    let nextTotal = 0;
    let nextCount = 0;
    for (let k = 1; k <= K; k++) {
      const point = multiplyFast(k, base);
      if (point === INF) {
        continue;
      }
      const bits = pointBits(point);
      for (let j = 0; j < keyBits; j++) {
        const flipped = k ^ (1 << j);
        if (flipped < 1) {
          continue;
        }
        const other = multiplyFast(flipped, base);
        if (other !== INF) {
          flipTotal += hammingDistance(bits, pointBits(other));
          flipCount++;
        }
      }
      const next = multiplyFast(k + 1, base);
      if (next !== INF) {
        nextTotal += hammingDistance(bits, pointBits(next));
        nextCount++;
      }
    }
    return { flip: flipTotal / flipCount, next: nextTotal / nextCount };
  }

  function run() {
    const base = points[Number(element("t3-g").value)];
    const K = Math.floor(Number(element("t3-K").value));
    element("t3-msg").textContent = "";
    const order = orderOf(base);
    showSubgroup(base, order);
    if (!Number.isInteger(K) || K < 1 || K > 2000) {
      element("t3-msg").textContent = "K must be a whole number between 1 and 2000.";
      return;
    }

    const keys = [];
    const xs = [];
    const ys = [];
    const frequency = {};
    let infinityCount = 0;
    multiplyStepByStep(K, base).forEach((point, i) => {
      if (point === INF) {
        infinityCount++;
        return;
      }
      keys.push(i + 1);
      xs.push(point.x);
      ys.push(point.y);
      frequency[formatPoint(point)] = (frequency[formatPoint(point)] || 0) + 1;
    });
    const n = xs.length;
    if (n === 0) {
      element("t3-msg").textContent = "Every multiple is INF for this G.";
      return;
    }

    const xCounts = new Array(P).fill(0);
    const yCounts = new Array(P).fill(0);
    const ones = new Array(2 * BITS).fill(0);
    for (let i = 0; i < n; i++) {
      xCounts[xs[i]]++;
      yCounts[ys[i]]++;
      pointBits({ x: xs[i], y: ys[i] }).forEach((bit, j) => {
        ones[j] += bit;
      });
    }
    const changes = avalanche(base, K);

    let bitHeader = "";
    let xShares = "";
    let yShares = "";
    for (let b = 0; b < BITS; b++) {
      bitHeader += `<th>bit ${BITS - 1 - b}</th>`;
      xShares += `<td>${fixed(ones[b] / n, 2)}</td>`;
      yShares += `<td>${fixed(ones[BITS + b] / n, 2)}</td>`;
    }
    const frequencyChips = Object.keys(frequency)
      .map((point) => `<li><b>${point}</b>${frequency[point]}×</li>`)
      .join("");
    const countChart = (title, counts) =>
      barChartHtml(counts, { title, showValues: true, format: (value) => value || "" });

    element("t3-results").innerHTML =
      `<h3>Results for G = ${formatPoint(base)}, k = 1…${K}</h3>` +
      `<p>Order of G: ${order}. The point at infinity appeared ${infinityCount} times; ` +
      `the other ${n} points include ${Object.keys(frequency).length} different ones.</p>` +
      `<div class="grid2">${countChart("Values of x", xCounts)}${countChart("Values of y", yCounts)}</div>` +
      `<h4>How often each point appears</h4><ul class="chips">${frequencyChips}</ul>` +
      '<div class="grid2"><div><h4>Share of bits equal to 1 (0.50 = balanced)</h4>' +
      `<div class="table-wrap"><table class="t-compact"><thead><tr><th></th>${bitHeader}</tr></thead>` +
      `<tbody><tr><td>x</td>${xShares}</tr><tr><td>y</td>${yShares}</tr></tbody></table></div></div>` +
      "<div><h4>Correlations and avalanche</h4><ul>" +
      `<li>Pearson correlation: k–x ${fixed(pearson(keys, xs))}, k–y ${fixed(pearson(keys, ys))}, x–y ${fixed(pearson(xs, ys))}</li>` +
      `<li>Flip one bit of k: ${fixed(changes.flip, 2)} of 10 output bits change (${fixed(changes.flip / 10)})</li>` +
      `<li>k → k + 1: ${fixed(changes.next, 2)} of 10 output bits change (${fixed(changes.next / 10)})</li>` +
      "<li>Reference: a good hash changes about half of the bits.</li></ul></div></div>";
  }

  fillPointSelect(element("t3-g"));
  element("t3-orders").innerHTML = points
    .map((point) => `<li><b>${formatPoint(point)}</b>order ${orderOf(point)}</li>`)
    .join("");
  element("t3-run").addEventListener("click", run);
  element("t3-g").addEventListener("change", run);
  run();
})();
