import {
  getTakuzuLineCellIndices,
  getTakuzuLineCells,
  listTakuzuLines,
  type TakuzuBoard,
  type TakuzuCell,
  type TakuzuLine,
  type TakuzuTile,
} from "@/games/takuzu/puzzle/board";

const maximumTakuzuRunLength = 2;

const takuzuTiles = ["a", "b"] as const satisfies readonly TakuzuTile[];

/**
 * 今の盤面だけから分かるルール違反。解答との照合は含めない。
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

/** 各行・各列が半分を超えずに全マス埋まっていれば、2種類のタイルはちょうど半分ずつになる。 */
export function isTakuzuSolved(board: TakuzuBoard): boolean {
  return (
    isEveryCellFilled(board.cells) &&
    !hasTakuzuRuleViolation(findTakuzuRuleViolations(board))
  );
}

function isSameLine(left: TakuzuLine, right: TakuzuLine): boolean {
  return left.axis === right.axis && left.index === right.index;
}

/** すべて埋まり、3連続・個数超過・重複のどの違反も無い行・列。 */
function listTakuzuCompletedLines(board: TakuzuBoard): TakuzuLine[] {
  const { runCellIndices, overfilledLines, duplicateLines } =
    findTakuzuRuleViolations(board);
  const runCells = new Set(runCellIndices);
  return listTakuzuLines(board.size).filter(function isCompleted(line) {
    const cellIndices = getTakuzuLineCellIndices(board.size, line);
    return (
      cellIndices.every((cellIndex) => board.cells[cellIndex] !== null) &&
      cellIndices.every((cellIndex) => !runCells.has(cellIndex)) &&
      !overfilledLines.some((other) => isSameLine(line, other)) &&
      !duplicateLines.some((other) => isSameLine(line, other))
    );
  });
}

/** 盤面が `before` から `after` へ変わって、違反なく埋まりきった行・列。 */
export function findTakuzuLinesCompletedBetween(
  before: TakuzuBoard,
  after: TakuzuBoard,
): TakuzuLine[] {
  const completedBefore = listTakuzuCompletedLines(before);
  return listTakuzuCompletedLines(after).filter(
    (line) => !completedBefore.some((other) => isSameLine(line, other)),
  );
}
