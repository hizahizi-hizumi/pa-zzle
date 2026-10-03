import {
  getTakuzuGridLineCellIndices,
  getTakuzuSquareShape,
  listTakuzuGridLines,
  type TakuzuBoard,
  type TakuzuCell,
  type TakuzuGrid,
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

/** 同じ数のルールは偶数の長さの並びにだけ成り立つ。奇数になるのは1行だけのチュートリアル盤面に限る。 */
function isLineOverfilled(cells: readonly TakuzuCell[]): boolean {
  if (cells.length % 2 !== 0) {
    return false;
  }
  const capacity = cells.length / 2;
  return takuzuTiles.some(function exceedsCapacity(tile) {
    return cells.filter((cell) => cell === tile).length > capacity;
  });
}

function isEveryCellFilled(cells: readonly TakuzuCell[]): boolean {
  return cells.every((cell) => cell !== null);
}

function getGridLineCells(grid: TakuzuGrid, line: TakuzuLine): TakuzuCell[] {
  return getTakuzuGridLineCellIndices(grid.shape, line).map(
    function getCell(cellIndex) {
      return grid.cells[cellIndex] ?? null;
    },
  );
}

function findDuplicateLines(grid: TakuzuGrid): TakuzuLine[] {
  const linesByPattern = new Map<string, TakuzuLine[]>();
  for (const line of listTakuzuGridLines(grid.shape)) {
    const cells = getGridLineCells(grid, line);
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

/** 正方形に限らないマスの並びのルール違反。`findTakuzuRuleViolations` と同じ規則で判定する。 */
export function findTakuzuGridRuleViolations(
  grid: TakuzuGrid,
): TakuzuRuleViolations {
  const runCellIndices = new Set<number>();
  const overfilledLines: TakuzuLine[] = [];
  for (const line of listTakuzuGridLines(grid.shape)) {
    const cellIndices = getTakuzuGridLineCellIndices(grid.shape, line);
    const cells = getGridLineCells(grid, line);
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
    duplicateLines: findDuplicateLines(grid),
  };
}

export function findTakuzuRuleViolations(
  board: TakuzuBoard,
): TakuzuRuleViolations {
  return findTakuzuGridRuleViolations({
    shape: getTakuzuSquareShape(board.size),
    cells: board.cells,
  });
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
