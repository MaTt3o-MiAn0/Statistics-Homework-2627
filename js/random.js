// Seeded pseudo-random generator (mulberry32).
// The same seed always gives the same sequence, so every experiment on the site is reproducible.
function createRandom(seed) {
  let state = seed;

  return function nextRandom() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
