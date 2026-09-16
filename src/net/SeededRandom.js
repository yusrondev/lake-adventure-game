// Fast Deterministic Mulberry32 Pseudorandom Number Generator for Multiplayer Synchronization

export class SeededRandom {
  constructor(seed = 123456) {
    this.initialSeed = seed;
    this.state = seed >>> 0;
  }

  setSeed(seed) {
    this.initialSeed = seed;
    this.state = seed >>> 0;
  }

  // Returns float in [0, 1)
  random() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.random() * (max - min);
  }

  choice(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(this.random() * arr.length)];
  }

  // Deterministic hash based on segment index and world seed
  static forSegment(worldSeed, segmentIndex) {
    const combinedSeed = ((worldSeed * 73856093) ^ (segmentIndex * 19349663)) >>> 0;
    return new SeededRandom(combinedSeed);
  }
}
