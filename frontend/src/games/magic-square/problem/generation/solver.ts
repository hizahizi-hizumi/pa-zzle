import {
  getMagicSquareLineCellIndices,
  getMagicSquareMagicSum,
  getMagicSquareMaxValue,
  listMagicSquareLines,
} from "@/games/magic-square/puzzle/board";
import { type ProblemRandom, shuffleProblemValues } from "@/games/problem-seed";

/** 生成で扱う盤面。数を行優先に並べ、空きは 0 にする。 */
export type MagicSquareGrid = readonly number[];

/** 問題として採るかを確かめるときの、完全な解法器の止め方。2解で止め、200万節点で打ち切る。 */
export const MAGIC_SQUARE_EXACT_SOLUTION_LIMIT = 2;
export const MAGIC_SQUARE_EXACT_NODE_CAP = 2_000_000;

/**
 * 数 1〜n² の集まり。6×6 は 1〜36 で 37 ビット要り、JavaScript のビット演算（32 ビット）に収まらないので、
 * 数 v を、v が 32 未満なら `low` のビット v、32 以上なら `high` のビット v−32 に置く。
 * ビットの低い順が数の小さい順になり、調査コードの整数1つの集まりと同じ順に数を取り出せる。
 */
type ValueSet = { low: number; high: number };

const WORD_BITS = 32;

function countWordBits(word: number): number {
  let value = word - ((word >>> 1) & 0x55555555);
  value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
  value = (value + (value >>> 4)) & 0x0f0f0f0f;
  return Math.imul(value, 0x01010101) >>> 24;
}

function hasValue(set: ValueSet, value: number): boolean {
  return value < WORD_BITS
    ? ((set.low >>> value) & 1) === 1
    : ((set.high >>> (value - WORD_BITS)) & 1) === 1;
}

function withoutValue(set: ValueSet, value: number): ValueSet {
  return value < WORD_BITS
    ? { low: (set.low & ~(1 << value)) >>> 0, high: set.high }
    : { low: set.low, high: (set.high & ~(1 << (value - WORD_BITS))) >>> 0 };
}

function singleValue(value: number): ValueSet {
  return value < WORD_BITS
    ? { low: (1 << value) >>> 0, high: 0 }
    : { low: 0, high: (1 << (value - WORD_BITS)) >>> 0 };
}

/** 1語の中で、ビット `from` から `to` まで（両端を含む）を立てた値。 */
function wordRange(from: number, to: number): number {
  return from > to ? 0 : (2 ** (to + 1) - 2 ** from) >>> 0;
}

/** 解法器が使う盤面の形。マスは行優先の番号、列は横・縦・斜め（左上から・右上から）の順。 */
type SolverGeometry = {
  size: number;
  cellCount: number;
  magicSum: number;
  lines: readonly (readonly number[])[];
  cellLines: readonly (readonly number[])[];
  allValues: ValueSet;
};

const geometries = new Map<number, SolverGeometry>();

function getSolverGeometry(size: number): SolverGeometry {
  const cached = geometries.get(size);
  if (cached) {
    return cached;
  }
  const cellCount = size * size;
  const lines = listMagicSquareLines(size).map((line) =>
    getMagicSquareLineCellIndices(size, line),
  );
  const geometry: SolverGeometry = {
    size,
    cellCount,
    magicSum: getMagicSquareMagicSum(size),
    lines,
    cellLines: Array.from({ length: cellCount }, (_, cellIndex) =>
      lines.flatMap((cells, lineIndex) =>
        cells.includes(cellIndex) ? [lineIndex] : [],
      ),
    ),
    allValues: rangeOfValues(1, getMagicSquareMaxValue(size), cellCount),
  };
  geometries.set(size, geometry);
  return geometry;
}

/** 数 `from`〜`to` の集まり。1 と n² の外は切る。 */
function rangeOfValues(from: number, to: number, maxValue: number): ValueSet {
  const first = Math.max(from, 1);
  const last = Math.min(to, maxValue);
  if (first > last) {
    return { low: 0, high: 0 };
  }
  return {
    low:
      first < WORD_BITS ? wordRange(first, Math.min(last, WORD_BITS - 1)) : 0,
    high:
      last >= WORD_BITS
        ? wordRange(Math.max(first, WORD_BITS) - WORD_BITS, last - WORD_BITS)
        : 0,
  };
}

/**
 * 列ごとの、その列の空いたマスに入りうる数（緩めた上下限）を書く置き場。節点ごとに書き直す。
 * 分けるマスとその候補は、次の節点へ進む前に読み終えるので、どの深さでも同じ置き場を使える。
 */
type AllowedValues = {
  low: Uint32Array;
  high: Uint32Array;
  prefixSums: Float64Array;
  suffixSums: Float64Array;
  values: Int32Array;
};

function createAllowedValues(geometry: SolverGeometry): AllowedValues {
  return {
    low: new Uint32Array(geometry.lines.length),
    high: new Uint32Array(geometry.lines.length),
    prefixSums: new Float64Array(geometry.cellCount + 1),
    suffixSums: new Float64Array(geometry.cellCount + 1),
    values: new Int32Array(geometry.cellCount),
  };
}

/** 集まりの数を、小さい順に `out` へ書き、書いた数を返す。 */
function writeValues(low: number, high: number, out: Int32Array): number {
  let count = 0;
  let rest = low;
  while (rest !== 0) {
    const lowest = rest & -rest;
    out[count] = 31 - Math.clz32(lowest);
    count += 1;
    rest = (rest ^ lowest) >>> 0;
  }
  rest = high;
  while (rest !== 0) {
    const lowest = rest & -rest;
    out[count] = WORD_BITS + 31 - Math.clz32(lowest);
    count += 1;
    rest = (rest ^ lowest) >>> 0;
  }
  return count;
}

/**
 * 列ごとに、その列の空いたマスに入りうる数（緩めた上下限）を `allowed` に書く。成り立たない列があれば `false`。
 * 空いたマスが k 個の列は、残りの合計を、使っていない数の小さい方 k 個の和から大きい方 k 個の和までに収める。
 * 空いたマスが1つの列は、残りの合計そのものが使っていない数なら、その数だけにする。
 */
function writeLineAllowedValues(
  geometry: SolverGeometry,
  grid: readonly number[],
  unusedLow: number,
  unusedHigh: number,
  allowed: AllowedValues,
): boolean {
  const { prefixSums, suffixSums, values } = allowed;
  const valueCount = writeValues(unusedLow, unusedHigh, values);
  prefixSums[0] = 0;
  suffixSums[0] = 0;
  for (let index = 0; index < valueCount; index += 1) {
    prefixSums[index + 1] = prefixSums[index]! + values[index]!;
    suffixSums[index + 1] =
      suffixSums[index]! + values[valueCount - 1 - index]!;
  }
  const { lines } = geometry;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!;
    let sum = 0;
    let emptyCount = 0;
    for (const cellIndex of line) {
      const value = grid[cellIndex]!;
      if (value === 0) {
        emptyCount += 1;
      } else {
        sum += value;
      }
    }
    const rest = geometry.magicSum - sum;
    if (emptyCount === 0) {
      if (rest !== 0) {
        return false;
      }
      allowed.low[lineIndex] = 0;
      allowed.high[lineIndex] = 0;
      continue;
    }
    if (
      emptyCount > valueCount ||
      rest < prefixSums[emptyCount]! ||
      rest > suffixSums[emptyCount]!
    ) {
      return false;
    }
    if (emptyCount === 1) {
      if (
        rest < 1 ||
        rest > geometry.cellCount ||
        !hasValue({ low: unusedLow, high: unusedHigh }, rest)
      ) {
        return false;
      }
      const single = singleValue(rest);
      allowed.low[lineIndex] = single.low;
      allowed.high[lineIndex] = single.high;
      continue;
    }
    const range = rangeOfValues(
      rest - suffixSums[emptyCount - 1]!,
      rest - prefixSums[emptyCount - 1]!,
      geometry.cellCount,
    );
    allowed.low[lineIndex] = range.low;
    allowed.high[lineIndex] = range.high;
  }
  return true;
}

export type MagicSquareSolverOptions = {
  /** この数の解を見つけたら止める。 */
  limit?: number;
  /** 調べた節点がこの数を超えたら打ち切る。`null` なら打ち切らない。 */
  nodeCap?: number | null;
  /** 渡すと、分けるマスに入れる数の順を、この乱数で並べ替える。乱択の魔方陣を作るときに使う。 */
  random?: ProblemRandom;
  /** 見つけた解を返すか。 */
  collect?: boolean;
};

/**
 * - `count`: 見つけた解の数（`limit` で止める）。
 * - `nodes`: 調べた節点の数。打ち切ったときは上限を1つ超えた数になる。
 * - `capped`: 節点の上限で打ち切ったか。打ち切ったときの `count` は、それまでに見つけた数。
 */
export type MagicSquareSolverResult = {
  count: number;
  nodes: number;
  capped: boolean;
  solutions: number[][];
};

/**
 * 与える数から解を数える完全な解法器。各節点で、列ごとの上下限から空いたマスの候補を作り、
 * 候補の最も少ないマス（同数なら番号の小さいマス）に入れる数で分ける。
 * 調査コード（`magic_square_difficulty.py` の `count_solutions`）と同じ順に調べるので、節点の数も同じになる。
 * 同じ数が2つある盤面は、調べずに解なしとする。
 */
export function countMagicSquareSolutions(
  size: number,
  givens: MagicSquareGrid,
  {
    limit = MAGIC_SQUARE_EXACT_SOLUTION_LIMIT,
    nodeCap = MAGIC_SQUARE_EXACT_NODE_CAP,
    random,
    collect = false,
  }: MagicSquareSolverOptions = {},
): MagicSquareSolverResult {
  const geometry = getSolverGeometry(size);
  const grid = [...givens];
  let unused = geometry.allValues;
  for (const value of grid) {
    if (value === 0) {
      continue;
    }
    if (!hasValue(unused, value)) {
      return { count: 0, nodes: 0, capped: false, solutions: [] };
    }
    unused = withoutValue(unused, value);
  }
  const result: MagicSquareSolverResult = {
    count: 0,
    nodes: 0,
    capped: false,
    solutions: [],
  };
  const stopped = () => result.count >= limit || result.capped;

  const allowed = createAllowedValues(geometry);
  const candidateValues = new Int32Array(geometry.cellCount);

  function search(remainingLow: number, remainingHigh: number): void {
    if (stopped()) {
      return;
    }
    result.nodes += 1;
    if (nodeCap !== null && result.nodes > nodeCap) {
      result.capped = true;
      return;
    }
    if (
      !writeLineAllowedValues(
        geometry,
        grid,
        remainingLow,
        remainingHigh,
        allowed,
      )
    ) {
      return;
    }
    let bestCellIndex = -1;
    let bestLow = 0;
    let bestHigh = 0;
    let bestCount = Number.POSITIVE_INFINITY;
    for (let cellIndex = 0; cellIndex < geometry.cellCount; cellIndex += 1) {
      if (grid[cellIndex] !== 0) {
        continue;
      }
      let low = remainingLow;
      let high = remainingHigh;
      for (const lineIndex of geometry.cellLines[cellIndex]!) {
        low &= allowed.low[lineIndex]!;
        high &= allowed.high[lineIndex]!;
      }
      const count = countWordBits(low) + countWordBits(high);
      if (count < bestCount) {
        bestCount = count;
        bestCellIndex = cellIndex;
        bestLow = low >>> 0;
        bestHigh = high >>> 0;
        if (count === 0) {
          return;
        }
      }
    }
    if (bestCellIndex < 0) {
      result.count += 1;
      if (collect) {
        result.solutions.push([...grid]);
      }
      return;
    }
    const valueCount = writeValues(bestLow, bestHigh, candidateValues);
    const ordered = Array.from(candidateValues.subarray(0, valueCount));
    for (const value of random
      ? shuffleProblemValues(ordered, random)
      : ordered) {
      grid[bestCellIndex] = value;
      const next = withoutValue(
        { low: remainingLow, high: remainingHigh },
        value,
      );
      search(next.low, next.high);
      grid[bestCellIndex] = 0;
      if (stopped()) {
        return;
      }
    }
  }

  search(unused.low, unused.high);
  return result;
}
