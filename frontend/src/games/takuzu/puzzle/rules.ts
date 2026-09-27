import {
  getTakuzuLineCellIndices,
  getTakuzuLineCells,
  listTakuzuLines,
  type TakuzuBoard,
  type TakuzuCell,
  type TakuzuLine,
  type TakuzuTile,
} from "@/games/takuzu/puzzle/board";

/** 同じタイルを続けて置ける最大数。これを超えて続くとルール違反になる。 */
const maximumTakuzuRunLength = 2;

const takuzuTiles = ["a", "b"] as const satisfies readonly TakuzuTile[];

/**
 * 今の盤面だけから分かるルール違反。解答との照合は含めない。
 * - `runCellIndices`: 同じタイルが3つ以上続いているマス。
 * - `overfilledLines`: どちらかのタイルが一辺の半分を超えた行・列。
 * - `duplicateLines`: すべて埋まり、並びが別の行（列）と一致した行・列。
 */
export type TakuzuRuleViolations = {
  runCellIndices: readonly number[];
  overfilledLines: readonly TakuzuLine[];
  duplicateLines: readonly TakuzuLine[];
};

function findRunCellIndicesInLine(
  cells: readonly TakuzuCell[],
  cellIndices: readonly number[],
): number[] {
  const runCellIndices: number[] = [];
  let runStart = 0;
  for (let position = 1; position <= cells.length; position += 1) {
    const runContinues =
      position < cells.length &&
      cells[position] !== null &&
      cells[position] === cells[runStart];
    if (runContinues) {
      continue;
    }
    const runLength = position - runStart;
    if (cells[runStart] !== null && runLength > maximumTakuzuRunLength) {
      runCellIndices.push(...cellIndices.slice(runStart, position));
    }
    runStart = position;
  }
  return runCellIndices;
}

function isLineOverfilled(cells: readonly TakuzuCell[]): boolean {
  const capacity = cells.length / 2;
  return takuzuTiles.some(function exceedsCapacity(tile) {
    return cells.filter((cell) => cell === tile).length > capacity;
  });
}

function isEveryCellFilled(cells: readonly TakuzuCell[]): boolean {
  return cells.every((cell) => cell !== null);
}

function findDuplicateLines(board: TakuzuBoard): TakuzuLine[] {
  const linesByPattern = new Map<string, TakuzuLine[]>();
  for (const line of listTakuzuLines(board.size)) {
    const cells = getTakuzuLineCells(board, line);
    if (!isEveryCellFilled(cells)) {
      continue;
    }
    const pattern = `${line.axis}:${cells.join("")}`;
    linesByPattern.set(pattern, [...(linesByPattern.get(pattern) ?? []), line]);
  }
  return [...linesByPattern.values()]
    .filter((lines) => lines.length > 1)
    .flat();
}

export function findTakuzuRuleViolations(
  board: TakuzuBoard,
): TakuzuRuleViolations {
  const runCellIndices = new Set<number>();
  const overfilledLines: TakuzuLine[] = [];
  for (const line of listTakuzuLines(board.size)) {
    const cellIndices = getTakuzuLineCellIndices(board.size, line);
    const cells = getTakuzuLineCells(board, line);
    for (const cellIndex of findRunCellIndicesInLine(cells, cellIndices)) {
      runCellIndices.add(cellIndex);
    }
    if (isLineOverfilled(cells)) {
      overfilledLines.push(line);
    }
  }

  return {
    runCellIndices: [...runCellIndices].sort((left, right) => left - right),
    overfilledLines,
    duplicateLines: findDuplicateLines(board),
  };
}

export function hasTakuzuRuleViolation(
  violations: TakuzuRuleViolations,
): boolean {
  return (
    violations.runCellIndices.length > 0 ||
    violations.overfilledLines.length > 0 ||
    violations.duplicateLines.length > 0
  );
}

/** 違反に関係するマス。個数超過と重複は、その行・列のマスすべてを含める。 */
export function listTakuzuViolatedCellIndices(
  size: number,
  violations: TakuzuRuleViolations,
): number[] {
  const lineCellIndices = [
    ...violations.overfilledLines,
    ...violations.duplicateLines,
  ].flatMap((line) => getTakuzuLineCellIndices(size, line));
  return [...new Set([...violations.runCellIndices, ...lineCellIndices])].sort(
    (left, right) => left - right,
  );
}

/**
 * 全マスが埋まり、ルール違反が無い。
 * 各行・各列が半分を超えずに全マス埋まっていれば、2種類のタイルはちょうど半分ずつになる。
 */
export function isTakuzuSolved(board: TakuzuBoard): boolean {
  return (
    isEveryCellFilled(board.cells) &&
    !hasTakuzuRuleViolation(findTakuzuRuleViolations(board))
  );
}
