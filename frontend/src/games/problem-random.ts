export type ProblemRandom = () => number;

function hashProblemRandomSource(source: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

export function createProblemRandom(source: string): ProblemRandom {
  let state = hashProblemRandomSource(source);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

export function shuffleProblemValues<T>(
  values: readonly T[],
  random: ProblemRandom,
): T[] {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const value = shuffled[index];
    const swapValue = shuffled[swapIndex];
    if (value === undefined || swapValue === undefined) {
      continue;
    }
    shuffled[index] = swapValue;
    shuffled[swapIndex] = value;
  }

  return shuffled;
}
