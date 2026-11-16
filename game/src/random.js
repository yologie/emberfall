// Emberfall — a tiny seeded RNG (mulberry32) plus small helpers.
// The live game feeds this Math.random; the deterministic screenshot scenes feed a
// fixed seed, so the same seed always stages the same frame.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A live-game RNG: seeded from real entropy when available (crypto), falling
// back to Math.random, but still going through the same function so every
// consumer only ever calls rng().
export function liveRng() {
  let seed = (Math.random() * 0xffffffff) >>> 0;
  try {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    seed = buf[0];
  } catch { /* crypto unavailable; the Math.random seed stands */ }
  return mulberry32(seed);
}

// Float in [min, max).
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// Integer in [min, max] inclusive.
export function intRange(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Pick one element of an array.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Angle in [0, 2π).
export function angle(rng) {
  return rng() * Math.PI * 2;
}

// Clamp a value into [min, max].
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// Linear interpolation.
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Distance between two points.
export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}
