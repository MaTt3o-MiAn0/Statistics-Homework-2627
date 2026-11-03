// Caesar cipher, statistical attack and experiments. Needs corpus.js (TRAIN_TEXT, TEST_TEXT).

// Shifts every letter by `shift` places; case is kept, other characters are unchanged.
function caesarShift(text, shift) {
  const positive = ((shift % 26) + 26) % 26;
  return text.replace(/[A-Za-z]/g, (letter) => {
    const base = letter <= "Z" ? 65 : 97;
    return String.fromCharCode(((letter.charCodeAt(0) - base + positive) % 26) + base);
  });
}

function caesarEncrypt(text, key) {
  return caesarShift(text, key);
}

function caesarDecrypt(text, key) {
  return caesarShift(text, -key);
}

// Counts of the 26 letters (upper and lower case are the same letter).
function letterCounts(text) {
  const counts = new Array(26).fill(0);
  for (const character of text) {
    if (/[A-Za-z]/.test(character)) {
      counts[character.toLowerCase().charCodeAt(0) - 97]++;
    }
  }
  return counts;
}

// Letter frequencies of English learned from the training corpus.
// +1 smoothing: no letter gets probability 0.
const LANGUAGE_MODEL = (function () {
  const counts = letterCounts(TRAIN_TEXT);
  const total = counts.reduce((sum, count) => sum + count, 0);
  return { counts, total, frequencies: counts.map((count) => (count + 1) / (total + 26)) };
})();

// Attack: for every candidate key s, undo the shift and measure how far the letter counts are
// from those expected in English (chi-squared statistic). The smallest value wins.
function attackCaesar(cipherText) {
  const counts = letterCounts(cipherText);
  const letters = counts.reduce((sum, count) => sum + count, 0);
  if (letters === 0) {
    return null;
  }

  const chiSquared = [];
  for (let s = 0; s < 26; s++) {
    let distance = 0;
    for (let i = 0; i < 26; i++) {
      // plaintext letter i corresponds to ciphertext letter i + s
      const expected = letters * LANGUAGE_MODEL.frequencies[i];
      const observed = counts[(i + s) % 26];
      distance += (observed - expected) ** 2 / expected;
    }
    chiSquared.push(distance);
  }

  const ranking = chiSquared.map((value, key) => [value, key]).sort((a, b) => a[0] - b[0]);
  return {
    key: ranking[0][1],
    chiSquared,
    counts,
    letters,
    confidence: ranking[1][0] / ranking[0][0],
  };
}

// Success rate of the attack for several ciphertext lengths, on passages of the test text
// (a different author from the training corpus). A fixed seed gives the same numbers every time.
function lengthExperiment(lengths, trials, seed) {
  const letters = TEST_TEXT.replace(/[^A-Za-z]/g, "").toLowerCase();
  const random = createRandom(seed);
  return lengths.map((length) => {
    let successes = 0;
    for (let t = 0; t < trials; t++) {
      const start = Math.floor(random() * (letters.length - length));
      const key = Math.floor(random() * 26);
      const cipherText = caesarEncrypt(letters.slice(start, start + length), key);
      if (attackCaesar(cipherText).key === key) {
        successes++;
      }
    }
    return { length, rate: successes / trials };
  });
}

// Single-symbol statistics: entropy (bits), index of coincidence, share of the most frequent symbol.
function symbolStatistics(counts) {
  const total = counts.reduce((sum, count) => sum + count, 0);
  let entropy = 0;
  let coincidences = 0;
  for (const count of counts) {
    if (count > 0) {
      entropy -= (count / total) * Math.log2(count / total);
      coincidences += count * (count - 1);
    }
  }
  return {
    total,
    entropy,
    coincidence: coincidences / (total * (total - 1)),
    topShare: Math.max(...counts) / total,
  };
}
