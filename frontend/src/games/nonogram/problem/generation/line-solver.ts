import type { NonogramClue } from "@/games/nonogram/puzzle/clue";

/** 線の読みで扱うマスの値。黒とも白とも決まっていないマスは `unknown`。 */
export const nonogramSolveCell = {
  unknown: -1,
  white: 0,
  black: 1,
} as const;

export type NonogramSolveCell =
  (typeof nonogramSolveCell)[keyof typeof nonogramSolveCell];

/** 1本の行・列のヒントと今のマスを読み、新しく決まったマスを埋めた線を返す。ヒントに合う置き方が無ければ `null`。 */
export type NonogramLineSolver = (
  clue: NonogramClue,
  line: readonly NonogramSolveCell[],
) => NonogramSolveCell[] | null;

const { unknown, white, black } = nonogramSolveCell;

/**
 * - `blockStarts[j]`: 線全体が成り立つ置き方の中で、塊 `j` を置ける開始位置（昇順）。
 * - `canBeWhite[i]`: 線全体が成り立つ置き方の中で、マス `i` を白にできるか。
 */
type LinePlacements = {
  blockStarts: number[][];
  canBeWhite: boolean[];
};

function countPrefix(
  line: readonly NonogramSolveCell[],
  value: NonogramSolveCell,
): Int32Array {
  const prefix = new Int32Array(line.length + 1);
  for (const [cellIndex, cell] of line.entries()) {
    prefix[cellIndex + 1] = prefix[cellIndex]! + (cell === value ? 1 : 0);
  }
  return prefix;
}

/**
 * 線全体が成り立つ置き方を、置き方を列挙せず前からと後ろからの動的計画法で求める。
 * - `fitsBefore[j][i]`: `line[0, i)` に塊 `0..j-1` を収め、残りを白にできる。
 * - `fitsFrom[j][i]`: `line[i, n)` に塊 `j..k-1` を収め、残りを白にできる。
 */
function findLinePlacements(
  clue: NonogramClue,
  line: readonly NonogramSolveCell[],
): LinePlacements | null {
  const cellCount = line.length;
  const blockCount = clue.length;
  const whitePrefix = countPrefix(line, white);
  const blackPrefix = countPrefix(line, black);

  function hasNoWhite(start: number, end: number): boolean {
    return whitePrefix[end] === whitePrefix[start];
  }
  function hasNoBlack(start: number, end: number): boolean {
    return blackPrefix[end] === blackPrefix[start];
  }

  const fitsBefore = Array.from(
    { length: blockCount + 1 },
    () => new Uint8Array(cellCount + 1),
  );
  for (let end = 0; end <= cellCount; end += 1) {
    fitsBefore[0]![end] = hasNoBlack(0, end) ? 1 : 0;
  }
  for (let blocks = 1; blocks <= blockCount; blocks += 1) {
    const length = clue[blocks - 1]!;
    const current = fitsBefore[blocks]!;
    const previous = fitsBefore[blocks - 1]!;
    for (let end = 0; end <= cellCount; end += 1) {
      let fits = end > 0 && current[end - 1] === 1 && line[end - 1] !== black;
      if (!fits && end >= length) {
        const start = end - length;
        if (hasNoWhite(start, end)) {
          fits =
            start === 0
              ? blocks === 1
              : line[start - 1] !== black && previous[start - 1] === 1;
        }
      }
      current[end] = fits ? 1 : 0;
    }
  }
  if (fitsBefore[blockCount]![cellCount] !== 1) {
    return null;
  }

  const fitsFrom = Array.from(
    { length: blockCount + 1 },
    () => new Uint8Array(cellCount + 1),
  );
  for (let start = 0; start <= cellCount; start += 1) {
    fitsFrom[blockCount]![start] = hasNoBlack(start, cellCount) ? 1 : 0;
  }
  for (let block = blockCount - 1; block >= 0; block -= 1) {
    const length = clue[block]!;
    const current = fitsFrom[block]!;
    const next = fitsFrom[block + 1]!;
    for (let start = cellCount; start >= 0; start -= 1) {
      let fits =
        start < cellCount && current[start + 1] === 1 && line[start] !== black;
      if (
        !fits &&
        start + length <= cellCount &&
        hasNoWhite(start, start + length)
      ) {
        const end = start + length;
        fits =
          end === cellCount
            ? block === blockCount - 1
            : line[end] !== black && next[end + 1] === 1;
      }
      current[start] = fits ? 1 : 0;
    }
  }

  const blockStarts = clue.map(function listStarts(length, block) {
    const starts: number[] = [];
    for (let start = 0; start + length <= cellCount; start += 1) {
      if (!hasNoWhite(start, start + length)) {
        continue;
      }
      const fitsLeft =
        start === 0
          ? block === 0
          : line[start - 1] !== black && fitsBefore[block]![start - 1] === 1;
      if (!fitsLeft) {
        continue;
      }
      const end = start + length;
      const fitsRight =
        end === cellCount
          ? block === blockCount - 1
          : line[end] !== black && fitsFrom[block + 1]![end + 1] === 1;
      if (fitsRight) {
        starts.push(start);
      }
    }
    return starts;
  });

  const canBeWhite = line.map(function canCellBeWhite(cell, cellIndex) {
    if (cell === black) {
      return false;
    }
    for (let blocks = 0; blocks <= blockCount; blocks += 1) {
      if (
        fitsBefore[blocks]![cellIndex] === 1 &&
        fitsFrom[blocks]![cellIndex + 1] === 1
      ) {
        return true;
      }
    }
    return false;
  });

  return { blockStarts, canBeWhite };
}

/**
 * 完全な線の読み。ヒントと今のマスに合う置き方すべてで同じになるマスを確定させる。
 * 1本だけを読んで決められるマスはすべて決まる。
 */
export function solveNonogramLineFully(
  clue: NonogramClue,
  line: readonly NonogramSolveCell[],
): NonogramSolveCell[] | null {
  const placements = findLinePlacements(clue, line);
  if (placements === null) {
    return null;
  }

  const coverageDelta = new Int32Array(line.length + 1);
  for (const [block, starts] of placements.blockStarts.entries()) {
    const length = clue[block]!;
    for (const start of starts) {
      coverageDelta[start]! += 1;
      coverageDelta[start + length]! -= 1;
    }
  }

  const solved = [...line];
  let coverage = 0;
  for (const [cellIndex, cell] of line.entries()) {
    coverage += coverageDelta[cellIndex]!;
    if (cell !== unknown) {
      continue;
    }
    const canBeBlack = coverage > 0;
    const canBeWhite = placements.canBeWhite[cellIndex] === true;
    if (canBeBlack && !canBeWhite) {
      solved[cellIndex] = black;
    } else if (canBeWhite && !canBeBlack) {
      solved[cellIndex] = white;
    } else if (!canBeBlack && !canBeWhite) {
      return null;
    }
  }
  return solved;
}

/**
 * 端寄せの読み。各塊を最も左（上）と最も右（下）に寄せた位置の重なりを黒、どの塊も届かないマスを白にする。
 * 人が普通に使う重なり・端からの押し出し・隙間の読みに近く、完全な線の読みより弱い。
 */
export function solveNonogramLineByEdges(
  clue: NonogramClue,
  line: readonly NonogramSolveCell[],
): NonogramSolveCell[] | null {
  const placements = findLinePlacements(clue, line);
  if (placements === null) {
    return null;
  }

  const solved = [...line];
  const reachable = new Array<boolean>(line.length).fill(false);
  for (const [block, starts] of placements.blockStarts.entries()) {
    const length = clue[block]!;
    const leftmost = starts[0]!;
    const rightmost = starts.at(-1)!;
    for (
      let cellIndex = leftmost;
      cellIndex < rightmost + length;
      cellIndex += 1
    ) {
      reachable[cellIndex] = true;
    }
    for (
      let cellIndex = rightmost;
      cellIndex < leftmost + length;
      cellIndex += 1
    ) {
      if (solved[cellIndex] === unknown) {
        solved[cellIndex] = black;
      }
    }
  }
  for (const [cellIndex, isReachable] of reachable.entries()) {
    if (!isReachable && solved[cellIndex] === unknown) {
      solved[cellIndex] = white;
    }
  }
  return solved;
}
