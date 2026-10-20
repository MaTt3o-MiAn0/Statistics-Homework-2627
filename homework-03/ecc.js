// Toy public-key scheme on the real secp256k1 curve (y^2 = x^3 + 7 over a 256-bit prime field),
// with a deliberately SMALL private key. BigInt arithmetic, no libraries.
const SECP = (function () {
  const P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn;
  const N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
  const G = { x: 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n,
              y: 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n };
  const mod = (a) => { const r = a % P; return r >= 0n ? r : r + P; };

  // modular inverse (extended Euclid)
  function inv(a) {
    let r0 = mod(a), r1 = P, s0 = 1n, s1 = 0n;
    while (r1) { const q = r0 / r1; [r0, r1] = [r1, r0 - q * r1]; [s0, s1] = [s1, s0 - q * s1]; }
    return mod(s0);
  }
  // Jacobian coordinates [X, Y, Z] (affine x = X/Z^2, y = Y/Z^3); Z = 0 is the point at infinity
  const JINF = [0n, 1n, 0n];
  function dbl(p) {
    const [X, Y, Z] = p;
    if (Z === 0n || Y === 0n) return JINF;
    const YY = Y * Y % P, S = 4n * X * YY % P, M = 3n * X * X % P;
    const X3 = mod(M * M - 2n * S);
    return [X3, mod(M * (S - X3) - 8n * YY * YY), 2n * Y * Z % P];
  }
  // Jacobian point + affine point (mixed addition)
  function addAff(p, q) {
    const [X1, Y1, Z1] = p;
    if (Z1 === 0n) return [q.x, q.y, 1n];
    const ZZ = Z1 * Z1 % P, H = mod(q.x * ZZ - X1), R = mod(q.y * ZZ % P * Z1 - Y1);
    if (H === 0n) return R === 0n ? dbl(p) : JINF;
    const H2 = H * H % P, H3 = H2 * H % P, V = X1 * H2 % P;
    const X3 = mod(R * R - H3 - 2n * V);
    return [X3, mod(R * (V - X3) - Y1 * H3), Z1 * H % P];
  }
  function toAffine(p) {
    if (p[2] === 0n) return null;
    const zi = inv(p[2]), zi2 = zi * zi % P;
    return { x: p[0] * zi2 % P, y: p[1] * zi2 % P * zi % P };
  }
  // k * pt (double-and-add, as in Homework 1 but with 256-bit numbers)
  function mul(k, pt) {
    let r = JINF;
    for (const bit of k.toString(2)) { r = dbl(r); if (bit === "1") r = addAff(r, pt); }
    return toAffine(r);
  }
  const isOnCurve = (pt) => mod(pt.y * pt.y) === mod(pt.x * pt.x * pt.x + 7n);
  return { P, N, G, mul, isOnCurve, JINF, dbl, addAff, toAffine, mod };
})();

// ---------- SHA-256 (used as key-derivation function) ----------
function sha256(bytes) {
  const K = [];
  for (let n = 2, c = 0; c < 64; n++) {
    let prime = true; for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
    if (prime) { K.push(Math.floor((Math.cbrt(n) % 1) * 4294967296) >>> 0); c++; }
  }
  const H = [];
  for (let n = 2, c = 0; c < 8; n++) {
    let prime = true; for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
    if (prime) { H.push(Math.floor((Math.sqrt(n) % 1) * 4294967296) >>> 0); c++; }
  }
  const len = bytes.length, total = (((len + 9 + 63) >> 6) << 6);
  const m = new Uint8Array(total); m.set(bytes); m[len] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(total - 8, Math.floor((len * 8) / 4294967296)); dv.setUint32(total - 4, (len * 8) >>> 0);
  const w = new Uint32Array(64), rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + 4 * i);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) >>> 0; });
  }
  const out = new Uint8Array(32), o = new DataView(out.buffer);
  H.forEach((v, i) => o.setUint32(4 * i, v));
  return out;
}

// ---------- the toy scheme ----------
const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const big32 = (n) => { const out = new Uint8Array(32); let v = n; for (let i = 31; i >= 0; i--) { out[i] = Number(v & 255n); v >>= 8n; } return out; };

// keystream = SHA-256("toyECIES" || x(S) || counter), concatenated until it is long enough
function keystream(S, length) {
  const label = new TextEncoder().encode("toyECIES"), out = new Uint8Array(length);
  for (let block = 0; block * 32 < length; block++) {
    const input = new Uint8Array(label.length + 32 + 4);
    input.set(label); input.set(big32(S.x), label.length);
    new DataView(input.buffer).setUint32(label.length + 32, block);
    out.set(sha256(input).subarray(0, Math.min(32, length - block * 32)), block * 32);
  }
  return out;
}
// random BigInt in [1, 2^bits - 1]
function randomScalar(bits) {
  const bytes = new Uint8Array(Math.ceil(bits / 8)); crypto.getRandomValues(bytes);
  let v = 0n; bytes.forEach((b) => { v = (v << 8n) | BigInt(b); });
  return (v % ((1n << BigInt(bits)) - 1n)) + 1n;
}
// key generation: private key d is restricted to [1, 2^bits - 1] (this is what makes the toy scheme weak)
function generateKeys(bits) { const d = randomScalar(bits); return { d, Q: SECP.mul(d, SECP.G) }; }
// encryption with the public key Q: ephemeral r, C1 = rG, S = rQ, C2 = M xor keystream(S)
function encrypt(msgBytes, Q, r) {
  r = r || randomScalar(128);
  const C1 = SECP.mul(r, SECP.G), S = SECP.mul(r, Q), ks = keystream(S, msgBytes.length);
  return { C1, C2: msgBytes.map((b, i) => b ^ ks[i]), S };
}
// decryption with the private key d: S = d*C1 = d*r*G = r*Q
function decrypt(C1, C2, d) {
  const S = SECP.mul(d, C1), ks = keystream(S, C2.length);
  return C2.map((b, i) => b ^ ks[i]);
}
// attack: find d with dG = Q by trying d = 1, 2, 3, ... (one point addition per candidate)
function bruteForceStart(Q) { return { R: [SECP.G.x, SECP.G.y, 1n], k: 1, Q, found: null }; }
function bruteForceChunk(st, steps) {
  const { P, G } = SECP, Q = st.Q;
  for (let i = 0; i < steps && st.found === null; i++) {
    const [X, Y, Z] = st.R, Z2 = Z * Z % P;
    if (Z !== 0n && X === Q.x * Z2 % P && Y === Q.y * Z2 % P * Z % P) { st.found = BigInt(st.k); break; }
    st.R = SECP.addAff(st.R, G); st.k++;
  }
  return st;
}
if (typeof module !== "undefined") module.exports = { SECP, sha256, toHex, keystream, generateKeys, encrypt, decrypt, bruteForceStart, bruteForceChunk, randomScalar };
