// Homework 3 page: toy ECC scheme, Caesar cipher, statistics, attacks.
(function () {
  const element = (id) => document.getElementById(id);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const hex64 = (value) => value.toString(16).padStart(64, "0");
  const escapeHtml = (text) => text.replace(/</g, "&lt;");

  // ---------- Task 1: toy ECC scheme ----------

  const ecc = { keys: null, encryption: null, previousCipher: null, bits: 16 };

  function generateKeyPair() {
    ecc.bits = Number(element("e-bits").value);
    ecc.keys = generateKeys(ecc.bits);
    ecc.encryption = null;
    ecc.previousCipher = null;
    const d = ecc.keys.privateKey;
    element("e-d").textContent = `${d} (0x${d.toString(16)})`;
    element("e-Qx").textContent = hex64(ecc.keys.publicKey.x);
    element("e-Qy").textContent = hex64(ecc.keys.publicKey.y);
    for (const id of ["e-C1x", "e-C1y", "e-C2", "e-Sx", "e-plain"]) {
      element(id).textContent = "–";
    }
    element("e-msg").textContent = `Key pair generated: d is a ${ecc.bits}-bit number.`;
  }

  function encryptMessage() {
    if (!ecc.keys) {
      generateKeyPair();
    }
    const encryption = encrypt(encoder.encode(element("msg").value), ecc.keys.publicKey);
    const cipherHex = toHex(encryption.C2);
    if (ecc.previousCipher === null) {
      element("e-msg").textContent = "Encrypted with a fresh ephemeral key r.";
    } else if (ecc.previousCipher === cipherHex) {
      element("e-msg").textContent = "Same ciphertext as before.";
    } else {
      element("e-msg").textContent =
        "New ciphertext: different from the previous one, although the message is the same.";
    }
    ecc.previousCipher = cipherHex;
    ecc.encryption = encryption;
    element("e-C1x").textContent = hex64(encryption.C1.x);
    element("e-C1y").textContent = hex64(encryption.C1.y);
    element("e-C2").textContent = cipherHex;
    element("e-Sx").textContent = hex64(encryption.secret.x);
    element("e-plain").textContent = "–";
  }

  function decryptMessage() {
    if (!ecc.encryption) {
      element("e-msg").textContent = "Encrypt first.";
      return;
    }
    const { C1, C2 } = ecc.encryption;
    const message = decoder.decode(decrypt(C1, C2, ecc.keys.privateKey));
    element("e-plain").textContent = message;
    element("e-msg").textContent =
      message === element("msg").value
        ? "Decrypted message equal to the original ✓"
        : "The message was changed after encryption.";
  }

  // ---------- Task 2: Caesar cipher ----------

  let lastCipherText = "";

  function showCaesar() {
    const key = Math.min(25, Math.max(0, Math.floor(Number(element("c-key").value)) || 0));
    lastCipherText = caesarEncrypt(element("msg").value, key);
    element("c-cipher").textContent = lastCipherText;
    element("c-plain").textContent = caesarDecrypt(lastCipherText, key);
    const plainRow = LETTERS.map((letter) => `<td>${letter}</td>`).join("");
    const cipherRow = LETTERS.map((letter, i) => `<td>${LETTERS[(i + key) % 26]}</td>`).join("");
    element("c-alpha").innerHTML =
      `<tbody><tr><th>plain</th>${plainRow}</tr><tr><th>cipher</th>${cipherRow}</tr></tbody>`;
  }

  // ---------- Task 3: statistics of the two ciphertexts ----------

  function showStatistics() {
    const plainText = TEST_TEXT.slice(0, 2000);
    const caesarText = caesarEncrypt(plainText, 7);
    const plainCounts = letterCounts(plainText);
    const caesarCounts = letterCounts(caesarText);
    // fixed keys, so that the numbers quoted in the text are reproducible
    const publicKey = SECP256K1.multiply(0xabcdn, SECP256K1.G);
    const eccBytes = encrypt(
      encoder.encode(plainText),
      publicKey,
      123456789012345678901234567890n,
    ).C2;
    const byteCounts = new Array(256).fill(0);
    for (const byte of eccBytes) {
      byteCounts[byte]++;
    }

    const topLetter = (counts) => LETTERS[counts.indexOf(Math.max(...counts))];
    const row = (name, stats, unit, maximum, symbol) => {
      const top = (stats.topShare * 100).toFixed(2) + "%" + (symbol ? ` (${symbol})` : "");
      return (
        `<tr><td>${name}</td><td>${stats.total} ${unit}</td><td>${stats.entropy.toFixed(3)} / ${maximum}</td>` +
        `<td>${stats.coincidence.toFixed(4)}</td><td>${top}</td></tr>`
      );
    };
    element("s-table").innerHTML =
      "<thead><tr><th>Text</th><th>Sample</th><th>Entropy (bits / maximum)</th>" +
      "<th>Index of coincidence</th><th>Most frequent symbol</th></tr></thead><tbody>" +
      row("Plaintext", symbolStatistics(plainCounts), "letters", "4.700", topLetter(plainCounts)) +
      row(
        "Caesar ciphertext",
        symbolStatistics(caesarCounts),
        "letters",
        "4.700",
        topLetter(caesarCounts),
      ) +
      row("ECC ciphertext", symbolStatistics(byteCounts), "bytes", "8.000", "") +
      "</tbody>";

    element("s-chart1").innerHTML = barChartHtml(caesarCounts, {
      title: "Caesar ciphertext: letter counts",
      labels: LETTERS,
    });
    const groups = new Array(32).fill(0);
    byteCounts.forEach((count, byte) => {
      groups[byte >> 3] += count;
    });
    element("s-chart2").innerHTML = barChartHtml(groups, {
      title: "ECC ciphertext: byte values in 32 groups of 8",
      labels: groups.map((count, i) => i * 8),
    });
  }

  // ---------- Task 4: statistical attack on Caesar ----------

  function runCaesarAttack() {
    const text = element("a-text").value;
    const result = attackCaesar(text);
    if (!result) {
      element("a-msg").textContent = "The text contains no letters.";
      element("a-out").innerHTML = "";
      return;
    }
    element("a-msg").textContent =
      result.letters < 30 ? `Only ${result.letters} letters: the result is not reliable.` : "";

    const countsChart = barChartHtml(result.counts, {
      title: "Letter counts in the ciphertext",
      labels: LETTERS,
    });
    const chiChart = barChartHtml(result.chiSquared, {
      title: "χ² for each candidate key (the lowest wins)",
      labels: result.chiSquared.map((value, key) => key),
      best: result.key,
      format: (value) => value.toFixed(0),
    });
    const decrypted =
      escapeHtml(caesarDecrypt(text, result.key).slice(0, 400)) + (text.length > 400 ? " …" : "");
    element("a-out").innerHTML =
      `<p class="result">Recovered key: <output>${result.key}</output> · letters used: ${result.letters} · ` +
      `confidence ratio (second-best χ² / best χ²): ${result.confidence.toFixed(2)}</p>` +
      `<div class="grid2">${countsChart}${chiChart}</div><p class="out">${decrypted}</p>`;
  }

  function showLengthExperiment() {
    const rows = lengthExperiment([5, 10, 15, 20, 30, 50, 100, 200, 500], 500, 2026);
    element("x-out").innerHTML = barChartHtml(
      rows.map((row) => Number((row.rate * 100).toFixed(1))),
      {
        title: "Success rate of the attack (%) by ciphertext length (letters)",
        labels: rows.map((row) => row.length),
        showValues: true,
        format: (value) => value,
      },
    );
  }

  // ---------- Task 5: brute force on the toy ECC key ----------

  function formatDuration(seconds) {
    if (seconds < 1e-3) {
      return "under 1 ms";
    }
    if (seconds < 1) {
      return (seconds * 1000).toFixed(0) + " ms";
    }
    if (seconds < 60) {
      return seconds.toFixed(1) + " s";
    }
    if (seconds < 3600) {
      return (seconds / 60).toFixed(1) + " minutes";
    }
    if (seconds < 86400) {
      return (seconds / 3600).toFixed(1) + " hours";
    }
    if (seconds < 3.156e7) {
      return (seconds / 86400).toFixed(1) + " days";
    }
    const years = seconds / 3.156e7;
    return years < 1e6
      ? years.toFixed(0) + " years"
      : years.toExponential(1).replace("e+", " × 10^") + " years";
  }

  function showAttackResult(search, total, milliseconds) {
    const rate = search.candidate / (milliseconds / 1000);
    const { C1, C2 } = ecc.encryption;
    const message = decoder.decode(decrypt(C1, C2, search.found));
    element("b-out").innerHTML =
      `<dt>Found d</dt><dd>${search.found}</dd>` +
      `<dt>Equal to the real d?</dt><dd>${search.found === ecc.keys.privateKey ? "yes" : "no"}</dd>` +
      `<dt>Candidates tried</dt><dd>${search.candidate} out of ${total}</dd>` +
      `<dt>Time</dt><dd>${milliseconds.toFixed(0)} ms (${Math.round(rate).toLocaleString("en-US")} candidates per second)</dd>` +
      `<dt>Decrypted</dt><dd>${escapeHtml(message)}</dd>`;

    const rows = [16, 20, 32, 48, 64, 128, 256].map((bits) => {
      const candidates = Math.pow(2, bits - 1);
      const shown = candidates.toExponential(2).replace("e+", " × 10^");
      return `<tr><td>${bits}</td><td>${shown}</td><td>${formatDuration(candidates / rate)}</td></tr>`;
    });
    element("b-table").innerHTML =
      "<thead><tr><th>Key size N (bits)</th><th>Average candidates 2^(N−1)</th><th>Estimated time</th></tr></thead>" +
      `<tbody>${rows.join("")}</tbody>`;
  }

  // The search runs in chunks, so the page stays responsive and the progress bar moves.
  function runBruteForce() {
    if (!ecc.keys) {
      generateKeyPair();
    }
    if (!ecc.encryption) {
      encryptMessage();
    }
    const total = Math.pow(2, ecc.bits);
    const search = startBruteForce(ecc.keys.publicKey);
    const startTime = performance.now();
    element("b-run").disabled = true;
    element("b-out").innerHTML = "";
    element("b-msg").textContent = "Searching…";

    const step = () => {
      continueBruteForce(search, 3000);
      element("b-prog").style.width = Math.min(100, (search.candidate / total) * 100) + "%";
      if (search.found === null) {
        setTimeout(step, 0);
        return;
      }
      element("b-run").disabled = false;
      element("b-msg").textContent = "";
      showAttackResult(search, total, performance.now() - startTime);
    };
    step();
  }

  // ---------- events and start ----------

  element("e-gen").addEventListener("click", generateKeyPair);
  element("e-enc").addEventListener("click", encryptMessage);
  element("e-dec").addEventListener("click", decryptMessage);
  element("e-bits").addEventListener("change", () => {
    ecc.keys = null;
    ecc.encryption = null;
    generateKeyPair();
  });
  element("c-key").addEventListener("input", showCaesar);
  element("msg").addEventListener("input", () => {
    showCaesar();
    ecc.encryption = null;
  });
  element("a-run").addEventListener("click", runCaesarAttack);
  element("a-use").addEventListener("click", () => {
    element("a-text").value = lastCipherText;
    runCaesarAttack();
  });
  element("b-run").addEventListener("click", runBruteForce);

  element("a-text").value = caesarEncrypt(TEST_TEXT.slice(20000, 20300), 11);
  showStatistics();
  showLengthExperiment();
  generateKeyPair();
  showCaesar();
})();
