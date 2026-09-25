export type ProblemSeed = string;

export function createProblemSeed(): ProblemSeed {
  const values = crypto.getRandomValues(new Uint32Array(4));

  return Array.from(values, (value) =>
    value.toString(16).padStart(8, "0"),
  ).join("");
}

export function hashProblemSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

export function createProblemSeededRandom(seed: string): () => number {
  let state = hashProblemSeed(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}
