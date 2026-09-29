export type ProblemSeed = string;

export type ProblemRandom = () => number;

export function createProblemSeed(): ProblemSeed {
  const values = crypto.getRandomValues(new Uint32Array(4));

  return Array.from(values, (value) =>
    value.toString(16).padStart(8, "0"),
  ).join("");
}

/**
 * 文字列を32bit符号なし整数へ写す。
 * 問題集の選択と生成済み問題の再現がこの値に依存するため、アルゴリズムを変えない。
 */
export function hashProblemSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/**
 * 同じ文字列から同じ [0, 1) の乱数列を返す。
 * 問題集は seed からこの乱数列で復元されるため、アルゴリズムを変えない。
 */
export function createProblemSeededRandom(seed: string): ProblemRandom {
  let state = hashProblemSeed(seed);

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
