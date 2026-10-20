// Caesar cipher, statistical attack and experiments. Needs corpus.js (TRAIN_TEXT, TEST_TEXT).

// shift every letter by `shift` places (case is kept, other characters are unchanged)
function caesarShift(text, shift) {
  shift = ((shift % 26) + 26) % 26;
  return text.replace(/[A-Za-z]/g, (ch) => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + shift) % 26) + base);
  });
}
const caesarEncrypt = (text, key) => caesarShift(text, key);
const caesarDecrypt = (text, key) => caesarShift(text, -key);

// counts of the 26 letters (A and a are the same letter)
function letterCounts(text) {
  const c = new Array(26).fill(0);
  for (const ch of text) if (/[A-Za-z]/.test(ch)) c[ch.toLowerCase().charCodeAt(0) - 97]++;
  return c;
}

// letter frequencies learned from the training corpus (+1 smoothing so that no letter has probability 0)
const MODEL = (function () {
  const counts = letterCounts(TRAIN_TEXT), total = counts.reduce((a, b) => a + b, 0);
  return { counts, total, freq: counts.map((c) => (c + 1) / (total + 26)) };
})();

// Attack: for every candidate key s, undo the shift and measure how far the letter counts are from the
// expected counts of the language (chi-squared statistic). The key with the smallest value wins.
function attack(cipherText) {
  const counts = letterCounts(cipherText), n = counts.reduce((a, b) => a + b, 0);
  if (n === 0) return null;
  const chi = [];
  for (let s = 0; s < 26; s++) {
    let x = 0;
    for (let i = 0; i < 26; i++) {              // plaintext letter i is the ciphertext letter i + s
      const expected = n * MODEL.freq[i], observed = counts[(i + s) % 26];
      x += ((observed - expected) ** 2) / expected;
    }
    chi.push(x);
  }
  const order = chi.map((v, s) => [v, s]).sort((a, b) => a[0] - b[0]);
  return { key: order[0][1], chi, counts, n, ratio: order[1][0] / order[0][0] };
}

// small seeded random generator, so that the experiment gives the same numbers every time
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// success rate of the attack for several ciphertext lengths, on passages of the (different) test text
function lengthExperiment(lengths, trials, seed) {
  const letters = TEST_TEXT.replace(/[^A-Za-z]/g, "").toLowerCase(), rand = mulberry32(seed);
  return lengths.map((L) => {
    let ok = 0;
    for (let t = 0; t < trials; t++) {
      const start = Math.floor(rand() * (letters.length - L)), key = Math.floor(rand() * 26);
      if (attack(caesarEncrypt(letters.slice(start, start + L), key)).key === key) ok++;
    }
    return { L, rate: ok / trials };
  });
}
// single-symbol statistics: entropy (bits), index of coincidence, share of the most frequent symbol
function symbolStats(counts) {
  const n = counts.reduce((a, b) => a + b, 0);
  let H = 0, ic = 0;
  counts.forEach((c) => { if (c) { H -= (c / n) * Math.log2(c / n); ic += c * (c - 1); } });
  return { n, H, ic: ic / (n * (n - 1)), top: Math.max(...counts) / n };
}
if (typeof module !== "undefined") module.exports = { caesarShift, caesarEncrypt, caesarDecrypt, letterCounts, MODEL, attack, lengthExperiment, symbolStats, mulberry32 };
