import type { TakuzuCell } from "@/games/takuzu/puzzle/board";

/**
 * 1本の行・列の並びをビット列で表す。位置 `p` のビットが 1 ならタイル `b`、0 なら `a`。
 * 解探索と人間向け解法器が、行・列の候補を速く照合するために使う。
 */
export type TakuzuLinePattern = number;

/**
 * 1本の行・列のうち、タイルが置かれている位置と、その並び。
 * - `knownMask`: タイルがある位置のビットが 1。
 * - `knownValue`: タイルがある位置のうち `b` のビットが 1。
 */
export type TakuzuLineKnowledge = {
  knownMask: number;
  knownValue: number;
};

const legalPatternsBySize = new Map<number, readonly TakuzuLinePattern[]>();

function countBits(value: number): number {
  let count = 0;
  for (let rest = value; rest !== 0; rest &= rest - 1) {
    count += 1;
  }
  return count;
}

function hasRunOfThree(pattern: TakuzuLinePattern, size: number): boolean {
  for (let position = 0; position + 2 < size; position += 1) {
    const window = (pattern >> position) & 0b111;
    if (window === 0b000 || window === 0b111) {
      return true;
    }
  }
  return false;
}

/** 1本の行・列だけで見て完成として正しい並び。2種類が半分ずつで、3つ続かない。 */
export function listLegalTakuzuLinePatterns(
  size: number,
): readonly TakuzuLinePattern[] {
  const cached = legalPatternsBySize.get(size);
  if (cached) {
    return cached;
  }
  const patterns: TakuzuLinePattern[] = [];
  for (let pattern = 0; pattern < 1 << size; pattern += 1) {
    if (countBits(pattern) === size / 2 && !hasRunOfThree(pattern, size)) {
      patterns.push(pattern);
    }
  }
  legalPatternsBySize.set(size, patterns);
  return patterns;
}

export function readTakuzuLineKnowledge(
  cells: readonly TakuzuCell[],
): TakuzuLineKnowledge {
  let knownMask = 0;
  let knownValue = 0;
  cells.forEach(function addCell(cell, position) {
    if (cell === null) {
      return;
    }
    knownMask |= 1 << position;
    if (cell === "b") {
      knownValue |= 1 << position;
    }
  });
  return { knownMask, knownValue };
}

export function isTakuzuLinePatternConsistent(
  pattern: TakuzuLinePattern,
  { knownMask, knownValue }: TakuzuLineKnowledge,
): boolean {
  return (pattern & knownMask) === knownValue;
}

export function getTakuzuLinePatternTile(
  pattern: TakuzuLinePattern,
  position: number,
): "a" | "b" {
  return (pattern >> position) & 1 ? "b" : "a";
}

export const _private = { countBits, hasRunOfThree };
