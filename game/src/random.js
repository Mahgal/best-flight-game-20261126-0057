// A tiny seeded generator (mulberry32) so clouds, trees and the staged
// screenshot scenes are identical on every load with the same seed.

export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  function range(low, high) {
    return low + next() * (high - low);
  }
  function pick(items) {
    return items[Math.floor(next() * items.length) % items.length];
  }
  return { next, range, pick };
}

export function hashNoise(x, z) {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
}
