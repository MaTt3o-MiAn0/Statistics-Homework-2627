// Toy public-key scheme on the real secp256k1 curve (y² = x³ + 7 over a 256-bit prime field),
// with a deliberately SMALL private key. BigInt arithmetic, no libraries.

const SECP256K1 = (function () {
  const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
  const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
  const G = {
    x: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
    y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
  };
  const INFINITY = [0n, 1n, 0n]; // Jacobian coordinates [X, Y, Z] with Z = 0

  const mod = (a) => {
    const r = a % P;
    return r >= 0n ? r : r + P;
  };

  // Modular inverse with the extended Euclidean algorithm.
  function inverse(a) {
    let [oldR, r] = [mod(a), P];
    let [oldS, s] = [1n, 0n];
    while (r) {
      const q = oldR / r;
      [oldR, r] = [r, oldR - q * r];
      [oldS, s] = [s, oldS - q * s];
    }
    return mod(oldS);
  }

  // Points in Jacobian coordinates: affine x = X/Z², y = Y/Z³. This avoids an inversion per step.
  function double(point) {
    const [X, Y, Z] = point;
    if (Z === 0n || Y === 0n) {
      return INFINITY;
    }
    const YY = (Y * Y) % P;
    const S = (4n * X * YY) % P;
    const M = (3n * X * X) % P;
    const X3 = mod(M * M - 2n * S);
    return [X3, mod(M * (S - X3) - 8n * YY * YY), (2n * Y * Z) % P];
  }

  // Jacobian point + affine point ("mixed" addition).
  function addAffine(point, affine) {
    const [X1, Y1, Z1] = point;
    if (Z1 === 0n) {
      return [affine.x, affine.y, 1n];
    }
    const ZZ = (Z1 * Z1) % P;
    const H = mod(affine.x * ZZ - X1);
    const R = mod(((affine.y * ZZ) % P) * Z1 - Y1);
    if (H === 0n) {
      return R === 0n ? double(point) : INFINITY;
    }
    const H2 = (H * H) % P;
    const H3 = (H2 * H) % P;
    const V = (X1 * H2) % P;
    const X3 = mod(R * R - H3 - 2n * V);
    return [X3, mod(R * (V - X3) - Y1 * H3), (Z1 * H) % P];
  }

  function toAffine(point) {
    if (point[2] === 0n) {
      return null;
    }
    const zInverse = inverse(point[2]);
    const zInverse2 = (zInverse * zInverse) % P;
    return { x: (point[0] * zInverse2) % P, y: (((point[1] * zInverse2) % P) * zInverse) % P };
  }

  // k · point with double-and-add, as in Homework 1 but with 256-bit numbers.
  function multiply(k, point) {
    let result = INFINITY;
    for (const bit of k.toString(2)) {
      result = double(result);
      if (bit === "1") {
        result = addAffine(result, point);
      }
    }
    return toAffine(result);
  }

  return { P, N, G, multiply, addAffine };
})();

// ---------- SHA-256, used to derive the keystream ----------

function firstPrimes(count) {
  const primes = [];
  for (let n = 2; primes.length < count; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) {
      if (n % d === 0) {
        prime = false;
        break;
      }
    }
    if (prime) {
      primes.push(n);
    }
  }
  return primes;
}

// The constants are the fractional parts of cube roots and square roots of the first primes.
const SHA256_K = firstPrimes(64).map((p) => Math.floor((Math.cbrt(p) % 1) * 4294967296) >>> 0);
const SHA256_H = firstPrimes(8).map((p) => Math.floor((Math.sqrt(p) % 1) * 4294967296) >>> 0);

function sha256(bytes) {
  const length = bytes.length;
  const paddedLength = ((length + 9 + 63) >> 6) << 6;
  const message = new Uint8Array(paddedLength);
  message.set(bytes);
  message[length] = 0x80;
  const view = new DataView(message.buffer);
  view.setUint32(paddedLength - 8, Math.floor((length * 8) / 4294967296));
  view.setUint32(paddedLength - 4, (length * 8) >>> 0);

  const hash = [...SHA256_H];
  const w = new Uint32Array(64);
  const rotate = (x, n) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + 4 * i);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotate(w[i - 15], 7) ^ rotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotate(w[i - 2], 17) ^ rotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      const s1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
      const choice = (e & f) ^ (~e & g);
      const t1 = (h + s1 + choice + SHA256_K[i] + w[i]) >>> 0;
      const s0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + majority) >>> 0;
      [h, g, f, e, d, c, b, a] = [g, f, e, (d + t1) >>> 0, c, b, a, (t1 + t2) >>> 0];
    }
    [a, b, c, d, e, f, g, h].forEach((value, i) => {
      hash[i] = (hash[i] + value) >>> 0;
    });
  }

  const digest = new Uint8Array(32);
  const digestView = new DataView(digest.buffer);
  hash.forEach((value, i) => digestView.setUint32(4 * i, value));
  return digest;
}

// ---------- the toy scheme ----------

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bigIntTo32Bytes(value) {
  const bytes = new Uint8Array(32);
  let rest = value;
  for (let i = 31; i >= 0; i--) {
    bytes[i] = Number(rest & 255n);
    rest >>= 8n;
  }
  return bytes;
}

// Keystream: SHA-256("toyECIES" || x(S) || counter), blocks joined until the message length.
function keystream(secret, length) {
  const label = new TextEncoder().encode("toyECIES");
  const stream = new Uint8Array(length);
  for (let block = 0; block * 32 < length; block++) {
    const input = new Uint8Array(label.length + 32 + 4);
    input.set(label);
    input.set(bigIntTo32Bytes(secret.x), label.length);
    new DataView(input.buffer).setUint32(label.length + 32, block);
    stream.set(sha256(input).subarray(0, Math.min(32, length - block * 32)), block * 32);
  }
  return stream;
}

// Random BigInt in [1, 2^bits - 1].
function randomScalar(bits) {
  const bytes = new Uint8Array(Math.ceil(bits / 8));
  crypto.getRandomValues(bytes);
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }
  return (value % ((1n << BigInt(bits)) - 1n)) + 1n;
}

// Key generation: the private key d is restricted to [1, 2^bits - 1]: this is the weakness.
function generateKeys(bits) {
  const privateKey = randomScalar(bits);
  return { privateKey, publicKey: SECP256K1.multiply(privateKey, SECP256K1.G) };
}

// Encryption with the public key Q: ephemeral r, C1 = rG, S = rQ, C2 = M xor keystream(S).
function encrypt(messageBytes, publicKey, ephemeral = randomScalar(128)) {
  const C1 = SECP256K1.multiply(ephemeral, SECP256K1.G);
  const secret = SECP256K1.multiply(ephemeral, publicKey);
  const stream = keystream(secret, messageBytes.length);
  return { C1, C2: messageBytes.map((byte, i) => byte ^ stream[i]), secret };
}

// Decryption with the private key d: S = d·C1 = d·r·G = r·Q.
function decrypt(C1, C2, privateKey) {
  const secret = SECP256K1.multiply(privateKey, C1);
  const stream = keystream(secret, C2.length);
  return C2.map((byte, i) => byte ^ stream[i]);
}

// Attack: find d with dG = Q by trying d = 1, 2, 3, ... (one point addition per candidate).
function startBruteForce(publicKey) {
  return { point: [SECP256K1.G.x, SECP256K1.G.y, 1n], candidate: 1, publicKey, found: null };
}

function continueBruteForce(search, steps) {
  const { P, G } = SECP256K1;
  const target = search.publicKey;
  for (let i = 0; i < steps && search.found === null; i++) {
    const [X, Y, Z] = search.point;
    const ZZ = (Z * Z) % P;
    // compare with the target without converting to affine coordinates (no inversion)
    if (Z !== 0n && X === (target.x * ZZ) % P && Y === (((target.y * ZZ) % P) * Z) % P) {
      search.found = BigInt(search.candidate);
      break;
    }
    search.point = SECP256K1.addAffine(search.point, G);
    search.candidate++;
  }
  return search;
}
