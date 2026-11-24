/**
 * 数 1〜n² の集まり。数 v をビット v に置いた整数で表す（0 は空の集まり）。
 * 6×6 は 1〜36 で 37 ビット要り、JavaScript のビット演算（32 ビット）に収まらないので、2^53 未満の数のまま持ち、
 * 下の32ビット（`>>> 0`）と上の32ビット（2^32 で割った商）に分けて演算する。どの値も整数で、`===` で比べられる。
 */
export type ValueMask = number;

const WORD = 2 ** 32;
const WORD_BITS = 32;

const valueBits: readonly number[] = Array.from(
  { length: 53 },
  (_, value) => 2 ** value,
);

function lowWord(mask: ValueMask): number {
  return mask >>> 0;
}

function highWord(mask: ValueMask): number {
  return Math.floor(mask / WORD);
}

function countWordBits(word: number): number {
  let value = word - ((word >>> 1) & 0x55555555);
  value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
  value = (value + (value >>> 4)) & 0x0f0f0f0f;
  return Math.imul(value, 0x01010101) >>> 24;
}

export function maskOfValue(value: number): ValueMask {
  return valueBits[value]!;
}

export function intersectMasks(left: ValueMask, right: ValueMask): ValueMask {
  const low = (lowWord(left) & lowWord(right)) >>> 0;
  if (left < WORD || right < WORD) {
    return low;
  }
  return low + (highWord(left) & highWord(right)) * WORD;
}

export function uniteMasks(left: ValueMask, right: ValueMask): ValueMask {
  const low = (lowWord(left) | lowWord(right)) >>> 0;
  if (left < WORD && right < WORD) {
    return low;
  }
  return low + (highWord(left) | highWord(right)) * WORD;
}

/** `left` から `right` の数を除いた集まり。 */
export function subtractMask(left: ValueMask, right: ValueMask): ValueMask {
  const low = (lowWord(left) & ~lowWord(right)) >>> 0;
  if (left < WORD) {
    return low;
  }
  return low + (highWord(left) & ~highWord(right)) * WORD;
}

export function hasMaskValue(mask: ValueMask, value: number): boolean {
  return value < WORD_BITS
    ? ((lowWord(mask) >>> value) & 1) === 1
    : ((highWord(mask) >>> (value - WORD_BITS)) & 1) === 1;
}

export function countMaskValues(mask: ValueMask): number {
  return mask < WORD
    ? countWordBits(mask)
    : countWordBits(lowWord(mask)) + countWordBits(highWord(mask));
}

/** 集まりの最も小さい数。空の集まりには使わない。 */
export function lowestMaskValue(mask: ValueMask): number {
  const low = lowWord(mask);
  if (low !== 0) {
    return 31 - Math.clz32(low & -low);
  }
  const high = highWord(mask);
  return WORD_BITS + 31 - Math.clz32(high & -high);
}

/** 集まりの最も大きい数。空の集まりには使わない。 */
export function highestMaskValue(mask: ValueMask): number {
  const high = highWord(mask);
  return high !== 0
    ? WORD_BITS + 31 - Math.clz32(high)
    : 31 - Math.clz32(lowWord(mask));
}

export function isSingleValueMask(mask: ValueMask): boolean {
  return mask !== 0 && countMaskValues(mask) === 1;
}

/** 数 `from`〜`to` の集まり。1 と `maxValue` の外は切る。 */
export function rangeMask(
  from: number,
  to: number,
  maxValue: number,
): ValueMask {
  const first = Math.max(from, 1);
  const last = Math.min(to, maxValue);
  return first > last ? 0 : valueBits[last + 1]! - valueBits[first]!;
}

/** 集まりの数を小さい順に並べる。 */
export function listMaskValues(mask: ValueMask): number[] {
  const values: number[] = [];
  let low = lowWord(mask);
  while (low !== 0) {
    const lowest = low & -low;
    values.push(31 - Math.clz32(lowest));
    low = (low ^ lowest) >>> 0;
  }
  let high = mask < WORD ? 0 : highWord(mask);
  while (high !== 0) {
    const lowest = high & -high;
    values.push(WORD_BITS + 31 - Math.clz32(lowest));
    high = (high ^ lowest) >>> 0;
  }
  return values;
}

/** 数 1〜`maxValue` の全部。 */
export function fullMask(maxValue: number): ValueMask {
  return rangeMask(1, maxValue, maxValue);
}
