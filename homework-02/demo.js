// Homework 2 page: the wallet pipeline step by step and the Keccak-256 avalanche experiment.
// Uses the ethers.js library, loaded from the CDN before this file.
(function () {
  const element = (id) => document.getElementById(id);
  const ethers = window.ethers;
  const PHRASE =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const PATH = "44'/60'/0'/0/0";
  const REFERENCE_ADDRESS = "0x9858EfFD232B4033E47d90003D41EC34EcaEda94";
  const LIBRARY_MISSING = "The ethers.js library could not be loaded (internet connection needed).";
  const stageChips = Array.from(document.querySelectorAll("#stages span"));

  let steps = [];
  let shown = 0;
  let timer = null;

  // ---------- the pipeline ----------

  // Every stage of the pipeline as [description, values to show].
  function computePipeline(passphrase) {
    const seed = ethers.Mnemonic.fromPhrase(PHRASE, passphrase).computeSeed();
    const master = ethers.HDNodeWallet.fromSeed(seed);
    const child = master.derivePath(PATH);
    const publicKey = ethers.SigningKey.computePublicKey(child.privateKey, false);
    const hash = ethers.keccak256("0x" + publicKey.slice(4));
    const lowercaseAddress = "0x" + hash.slice(-40);
    const checksumHash = ethers.keccak256(ethers.toUtf8Bytes(lowercaseAddress.slice(2)));
    return [
      [
        "BIP-39: mnemonic and passphrase to a 512-bit seed (PBKDF2-HMAC-SHA512, 2048 rounds)",
        [seed],
      ],
      [
        "BIP-32: HMAC-SHA512 of the seed gives the master private key and the chain code",
        [master.privateKey, master.chainCode],
      ],
      [
        `BIP-44: child derivation along m/${PATH} gives the Ethereum private key`,
        [child.privateKey],
      ],
      ["secp256k1: public key Q = kG, uncompressed (04, then X and Y)", [publicKey]],
      [
        "Keccak-256 of X and Y (64 bytes, without the 04 prefix); the last 20 bytes are the address",
        [hash, "address: " + lowercaseAddress],
      ],
      [
        "EIP-55: the case of each letter follows the Keccak-256 hash of the lowercase address",
        [checksumHash, "checksummed: " + ethers.getAddress(lowercaseAddress)],
      ],
    ];
  }

  function stopPlaying() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    element("play").textContent = "Play";
  }

  function finalMessage() {
    if (element("pp").value !== "") {
      return "Done. With a passphrase the wallet is different, so there is no reference to compare.";
    }
    const address = steps[5][1][1].replace("checksummed: ", "");
    return address === REFERENCE_ADDRESS
      ? "The final address matches the known reference address for this test phrase."
      : "The final address does not match the reference.";
  }

  function render() {
    element("stepsOut").innerHTML = steps
      .slice(0, shown)
      .map(([description, values], i) => {
        const codes = values.map((value) => `<code>${value}</code>`).join("");
        return `<li><strong>Step ${i + 1}.</strong> ${description}${codes}</li>`;
      })
      .join("");
    stageChips.forEach((chip, i) => {
      chip.className = i < shown ? (i === shown - 1 ? "done now" : "done") : "";
    });
    element("prog").style.width = (shown / 6) * 100 + "%";

    const finished = steps.length > 0 && shown >= steps.length;
    element("next").disabled = finished;
    if (finished) {
      stopPlaying();
      element("demomsg").textContent = finalMessage();
    } else {
      element("demomsg").textContent = "";
    }
  }

  function restart() {
    stopPlaying();
    if (!ethers) {
      element("demomsg").textContent = LIBRARY_MISSING;
      return false;
    }
    steps = computePipeline(element("pp").value);
    shown = 0;
    render();
    return true;
  }

  function nextStep() {
    if (steps.length === 0 && !restart()) {
      return;
    }
    if (shown < steps.length) {
      shown++;
    }
    render();
  }

  function togglePlay() {
    if (timer) {
      stopPlaying();
      return;
    }
    if ((steps.length === 0 || shown >= steps.length) && !restart()) {
      return;
    }
    element("play").textContent = "Pause";
    nextStep();
    timer = setInterval(nextStep, 1100);
  }

  // ---------- Keccak-256 avalanche experiment ----------

  function countOnes(byte) {
    let ones = 0;
    let rest = byte;
    while (rest) {
      ones += rest & 1;
      rest >>= 1;
    }
    return ones;
  }

  function bitDistance(first, second) {
    let distance = 0;
    for (let i = 0; i < first.length; i++) {
      distance += countOnes(first[i] ^ second[i]);
    }
    return distance;
  }

  const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

  // 64 trials: in trial i one bit of byte i of the public key is flipped and the hash recomputed.
  function runAvalanche() {
    if (!ethers) {
      element("avOut").textContent = LIBRARY_MISSING;
      return;
    }
    const seed = ethers.Mnemonic.fromPhrase(PHRASE, "").computeSeed();
    const privateKey = ethers.HDNodeWallet.fromSeed(seed).derivePath(PATH).privateKey;
    const publicKey = ethers
      .getBytes(ethers.SigningKey.computePublicKey(privateKey, false))
      .slice(1);
    const originalHash = ethers.getBytes(ethers.keccak256(publicKey));

    const fullDistances = [];
    const addressDistances = [];
    let ones = 0;
    for (let i = 0; i < 64; i++) {
      const modified = publicKey.slice();
      modified[i] ^= 1 << i % 8;
      const hash = ethers.getBytes(ethers.keccak256(modified));
      fullDistances.push(bitDistance(originalHash, hash));
      addressDistances.push(bitDistance(originalHash.slice(12), hash.slice(12)));
      for (const byte of hash) {
        ones += countOnes(byte);
      }
    }

    const shareOfOnes = ones / (64 * 256);
    const entropy =
      -shareOfOnes * Math.log2(shareOfOnes) - (1 - shareOfOnes) * Math.log2(1 - shareOfOnes);
    const firstBin = Math.floor(Math.min(...fullDistances) / 4) * 4;
    const lastValue = Math.max(...fullDistances);
    const binStarts = [];
    const binCounts = [];
    for (let start = firstBin; start <= lastValue; start += 4) {
      binStarts.push(start);
      binCounts.push(fullDistances.filter((value) => value >= start && value < start + 4).length);
    }
    const chart = barChartHtml(binCounts, {
      title: "Changed bits per trial (64 trials)",
      labels: binStarts,
      showValues: true,
      format: (value) => value || "",
    });

    element("avOut").innerHTML =
      '<div class="split"><ul>' +
      `<li>Average changed bits of the 256-bit hash: <strong>${average(fullDistances).toFixed(2)}</strong> (about 128 expected)</li>` +
      `<li>Average changed bits in the last 160 bits: <strong>${average(addressDistances).toFixed(2)}</strong> (about 80 expected)</li>` +
      `<li>Share of 1 bits in the 64 modified hashes: <strong>${(shareOfOnes * 100).toFixed(2)}%</strong> (about 50% expected)</li>` +
      `<li>Entropy of the 0/1 shares: <strong>${entropy.toFixed(4)}</strong> bits per bit (maximum 1)</li>` +
      `</ul>${chart}</div>`;
  }

  element("next").addEventListener("click", nextStep);
  element("restart").addEventListener("click", restart);
  element("pp").addEventListener("change", restart);
  element("play").addEventListener("click", togglePlay);
  element("runAv").addEventListener("click", runAvalanche);
})();
