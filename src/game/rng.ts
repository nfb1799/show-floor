/**
 * Seeded RNG. Always injected, never imported as a singleton, so any run or
 * any single pitch can be replayed exactly.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max], inclusive both ends. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** Picks by relative weight. Entries with weight <= 0 are ignored. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
  /** Returns a new shuffled array; the input is not modified. */
  shuffle<T>(items: readonly T[]): T[];
  /**
   * Derives an independent child stream from the current state without
   * advancing this one. Same label + same parent state => same child.
   */
  fork(label: string): Rng;
  /** Current internal state, for snapshotting a run mid-flight. */
  readonly state: number;
}

const UINT32 = 0x100000000;

export function hashSeed(seed: string): number {
  // FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createRng(seed: number | string): Rng {
  // mulberry32: state is a plain counter, which keeps `state` snapshottable.
  let state = (typeof seed === 'string' ? hashSeed(seed) : seed) >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32;
  };

  const rng: Rng = {
    next,

    int(min, max) {
      if (max < min) throw new Error(`rng.int: max (${max}) < min (${min})`);
      return min + Math.floor(next() * (max - min + 1));
    },

    pick(items) {
      if (items.length === 0) throw new Error('rng.pick: empty list');
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error('rng.pick: out of range');
      return item;
    },

    weighted(entries) {
      let total = 0;
      for (const [, weight] of entries) {
        if (weight > 0) total += weight;
      }
      if (total <= 0) throw new Error('rng.weighted: no entry with positive weight');

      let roll = next() * total;
      for (const [value, weight] of entries) {
        if (weight <= 0) continue;
        roll -= weight;
        if (roll < 0) return value;
      }
      // Only reachable through float drift on the final entry.
      const last = entries[entries.length - 1];
      if (last === undefined) throw new Error('rng.weighted: empty list');
      return last[0];
    },

    shuffle(items) {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const a = out[i];
        const b = out[j];
        if (a === undefined || b === undefined) continue;
        out[i] = b;
        out[j] = a;
      }
      return out;
    },

    fork(label) {
      const mixed = (Math.imul(state ^ hashSeed(label), 0x9e3779b1) >>> 0) ^ 0x85ebca6b;
      return createRng(mixed >>> 0);
    },

    get state() {
      return state;
    },
  };

  return rng;
}
