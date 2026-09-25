import { isSolvableFifteenPuzzleBoard } from "@/games/fifteen-puzzle/puzzle/rules";
import {
  FIFTEEN_PUZZLE_BLANK,
  FIFTEEN_PUZZLE_CELL_COUNT,
  FIFTEEN_PUZZLE_SIZE,
  type FifteenPuzzleBoard,
  getFifteenPuzzleColumn,
  getFifteenPuzzleRow,
  isFifteenPuzzleSolved,
} from "@/games/fifteen-puzzle/puzzle/state";

/**
 * IDA* が使う許容的な下界。探索中は盤面を書き換えながら差分で更新する。
 */
export type FifteenPuzzleHeuristic = {
  /** 盤面全体から下界を求め、差分更新の内部状態を作り直す。 */
  reset(cells: Uint8Array): number;
  /** `cells` は移動後の盤面。`tile` が `from` から `to` へ動いた後の下界を返す。 */
  update(cells: Uint8Array, tile: number, from: number, to: number): number;
};

type FifteenPuzzleSolveOptions = {
  /** 展開するノード数の上限。正の整数で、超えたら `limit-exceeded` を返す。省略すると上限なし。 */
  nodeLimit?: number;
  heuristic?: FifteenPuzzleHeuristic;
};

type FifteenPuzzleSolveResult =
  | {
      status: "solved";
      optimalMoveCount: number;
      expandedNodeCount: number;
    }
  | { status: "limit-exceeded"; expandedNodeCount: number };

const LINE_CELL_KEY_BASE = FIFTEEN_PUZZLE_CELL_COUNT;
const LINE_KEY_COUNT = LINE_CELL_KEY_BASE ** FIFTEEN_PUZZLE_SIZE;

const neighborCells: readonly (readonly number[])[] = Array.from(
  { length: FIFTEEN_PUZZLE_CELL_COUNT },
  (_, cellIndex) => {
    const row = getFifteenPuzzleRow(cellIndex);
    const column = getFifteenPuzzleColumn(cellIndex);
    return [
      row > 0 ? cellIndex - FIFTEEN_PUZZLE_SIZE : null,
      row < FIFTEEN_PUZZLE_SIZE - 1 ? cellIndex + FIFTEEN_PUZZLE_SIZE : null,
      column > 0 ? cellIndex - 1 : null,
      column < FIFTEEN_PUZZLE_SIZE - 1 ? cellIndex + 1 : null,
    ].filter((neighbor) => neighbor !== null);
  },
);

function goalCellOf(tile: number): number {
  return tile - 1;
}

function tileDistance(tile: number, cellIndex: number): number {
  const goalCell = goalCellOf(tile);
  return (
    Math.abs(getFifteenPuzzleRow(cellIndex) - getFifteenPuzzleRow(goalCell)) +
    Math.abs(
      getFifteenPuzzleColumn(cellIndex) - getFifteenPuzzleColumn(goalCell),
    )
  );
}

const tileDistanceTable = Uint8Array.from(
  { length: FIFTEEN_PUZZLE_CELL_COUNT * FIFTEEN_PUZZLE_CELL_COUNT },
  (_, key) => {
    const tile = Math.floor(key / FIFTEEN_PUZZLE_CELL_COUNT);
    return tile === FIFTEEN_PUZZLE_BLANK
      ? 0
      : tileDistance(tile, key % FIFTEEN_PUZZLE_CELL_COUNT);
  },
);

function lengthOfLongestIncreasingSubsequence(values: readonly number[]) {
  const lengths = values.map(() => 1);
  for (const [index, value] of values.entries()) {
    for (let previous = 0; previous < index; previous += 1) {
      if ((values[previous] ?? 0) < value) {
        lengths[index] = Math.max(
          lengths[index] ?? 1,
          (lengths[previous] ?? 0) + 1,
        );
      }
    }
  }
  return Math.max(0, ...lengths);
}

/**
 * 行（または列）の中にゴールがあるタイルのうち、順序を正すために列（行）外へ
 * 一度退避させる必要がある枚数 × 2。退避したタイルは最低 2 手余計に動く。
 */
function lineConflictOf(
  tiles: readonly number[],
  isRow: boolean,
  line: number,
) {
  const goalOrders = tiles.flatMap((tile) => {
    if (tile === FIFTEEN_PUZZLE_BLANK) {
      return [];
    }
    const goalCell = goalCellOf(tile);
    const goalLine = isRow
      ? getFifteenPuzzleRow(goalCell)
      : getFifteenPuzzleColumn(goalCell);
    if (goalLine !== line) {
      return [];
    }
    return [
      isRow ? getFifteenPuzzleColumn(goalCell) : getFifteenPuzzleRow(goalCell),
    ];
  });
  return (
    2 * (goalOrders.length - lengthOfLongestIncreasingSubsequence(goalOrders))
  );
}

function createLineConflictTable(isRow: boolean, line: number): Uint8Array {
  const table = new Uint8Array(LINE_KEY_COUNT);
  for (let key = 0; key < LINE_KEY_COUNT; key += 1) {
    const tiles: number[] = [];
    let rest = key;
    for (let offset = 0; offset < FIFTEEN_PUZZLE_SIZE; offset += 1) {
      tiles.push(rest % LINE_CELL_KEY_BASE);
      rest = Math.floor(rest / LINE_CELL_KEY_BASE);
    }
    table[key] = lineConflictOf(tiles, isRow, line);
  }
  return table;
}

let lineConflictTables: {
  rows: readonly Uint8Array[];
  columns: readonly Uint8Array[];
} | null = null;

function getLineConflictTables() {
  lineConflictTables ??= {
    rows: Array.from({ length: FIFTEEN_PUZZLE_SIZE }, (_, row) =>
      createLineConflictTable(true, row),
    ),
    columns: Array.from({ length: FIFTEEN_PUZZLE_SIZE }, (_, column) =>
      createLineConflictTable(false, column),
    ),
  };
  return lineConflictTables;
}

function rowKey(cells: Uint8Array, row: number): number {
  const start = row * FIFTEEN_PUZZLE_SIZE;
  let key = 0;
  for (let offset = FIFTEEN_PUZZLE_SIZE - 1; offset >= 0; offset -= 1) {
    key = key * LINE_CELL_KEY_BASE + (cells[start + offset] ?? 0);
  }
  return key;
}

function columnKey(cells: Uint8Array, column: number): number {
  let key = 0;
  for (let offset = FIFTEEN_PUZZLE_SIZE - 1; offset >= 0; offset -= 1) {
    key =
      key * LINE_CELL_KEY_BASE +
      (cells[offset * FIFTEEN_PUZZLE_SIZE + column] ?? 0);
  }
  return key;
}

/**
 * マンハッタン距離総和 + 線形衝突（Hansson, Mayer & Yung 1992）。
 * 同じ行・列にゴールがあり、ゴールの前後が逆になっているタイルは、
 * 少なくとも一方が行・列の外へ一度出る必要がある。
 */
function createFifteenPuzzleManhattanLinearConflictHeuristic(): FifteenPuzzleHeuristic {
  const tables = getLineConflictTables();
  const rowConflicts = new Uint8Array(FIFTEEN_PUZZLE_SIZE);
  const columnConflicts = new Uint8Array(FIFTEEN_PUZZLE_SIZE);
  let manhattanDistance = 0;
  let conflictTotal = 0;

  return {
    reset(cells) {
      manhattanDistance = 0;
      for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
        manhattanDistance +=
          tileDistanceTable[
            (cells[cellIndex] ?? 0) * FIFTEEN_PUZZLE_CELL_COUNT + cellIndex
          ] ?? 0;
      }
      conflictTotal = 0;
      for (let line = 0; line < FIFTEEN_PUZZLE_SIZE; line += 1) {
        rowConflicts[line] = tables.rows[line]?.[rowKey(cells, line)] ?? 0;
        columnConflicts[line] =
          tables.columns[line]?.[columnKey(cells, line)] ?? 0;
        conflictTotal +=
          (rowConflicts[line] ?? 0) + (columnConflicts[line] ?? 0);
      }
      return manhattanDistance + conflictTotal;
    },
    update(cells, tile, from, to) {
      const tileOffset = tile * FIFTEEN_PUZZLE_CELL_COUNT;
      manhattanDistance +=
        (tileDistanceTable[tileOffset + to] ?? 0) -
        (tileDistanceTable[tileOffset + from] ?? 0);

      const fromRow = getFifteenPuzzleRow(from);
      const toRow = getFifteenPuzzleRow(to);
      if (fromRow === toRow) {
        // 横に動いたタイルは、行の中の順序を変えず、列だけを移る。
        for (const column of [
          getFifteenPuzzleColumn(from),
          getFifteenPuzzleColumn(to),
        ]) {
          const next = tables.columns[column]?.[columnKey(cells, column)] ?? 0;
          conflictTotal += next - (columnConflicts[column] ?? 0);
          columnConflicts[column] = next;
        }
      } else {
        for (const row of [fromRow, toRow]) {
          const next = tables.rows[row]?.[rowKey(cells, row)] ?? 0;
          conflictTotal += next - (rowConflicts[row] ?? 0);
          rowConflicts[row] = next;
        }
      }

      return manhattanDistance + conflictTotal;
    },
  };
}

class NodeLimitExceeded extends Error {}

function isGoal(cells: Uint8Array): boolean {
  for (let cellIndex = 0; cellIndex < cells.length - 1; cellIndex += 1) {
    if (cells[cellIndex] !== cellIndex + 1) {
      return false;
    }
  }
  return true;
}

/**
 * 反復深化 A*（Korf 1985）で、タイル 1 枚の移動を 1 手とした最短手数を求める。
 */
export function solveFifteenPuzzleOptimally(
  board: FifteenPuzzleBoard,
  options: FifteenPuzzleSolveOptions = {},
): FifteenPuzzleSolveResult {
  if (!isSolvableFifteenPuzzleBoard(board)) {
    throw new RangeError("Fifteen puzzle board must be solvable");
  }
  const nodeLimit = options.nodeLimit ?? Number.POSITIVE_INFINITY;
  if (
    nodeLimit !== Number.POSITIVE_INFINITY &&
    !(Number.isInteger(nodeLimit) && nodeLimit > 0)
  ) {
    throw new RangeError("nodeLimit must be a positive integer");
  }
  const heuristic =
    options.heuristic ?? createFifteenPuzzleManhattanLinearConflictHeuristic();
  const cells = Uint8Array.from(board);
  let blankCell = cells.indexOf(FIFTEEN_PUZZLE_BLANK);
  let expandedNodeCount = 0;
  let solvedDepth = 0;

  if (isFifteenPuzzleSolved(board)) {
    return { status: "solved", optimalMoveCount: 0, expandedNodeCount };
  }

  // 上限を超えた f 値の最小値を返す。解に届いたら -1 を返す。
  function search(
    depth: number,
    bound: number,
    previousBlankCell: number,
  ): number {
    expandedNodeCount += 1;
    if (expandedNodeCount > nodeLimit) {
      throw new NodeLimitExceeded();
    }

    let nextBound = Number.POSITIVE_INFINITY;
    const currentBlankCell = blankCell;
    for (const tileCell of neighborCells[currentBlankCell] ?? []) {
      if (tileCell === previousBlankCell) {
        continue;
      }

      const tile = cells[tileCell] ?? 0;
      cells[currentBlankCell] = tile;
      cells[tileCell] = FIFTEEN_PUZZLE_BLANK;
      blankCell = tileCell;
      const nextEstimate = heuristic.update(
        cells,
        tile,
        tileCell,
        currentBlankCell,
      );

      const cost = depth + 1 + nextEstimate;
      let result: number;
      if (cost > bound) {
        result = cost;
      } else if (nextEstimate === 0 && isGoal(cells)) {
        solvedDepth = depth + 1;
        result = -1;
      } else {
        result = search(depth + 1, bound, currentBlankCell);
      }

      cells[tileCell] = tile;
      cells[currentBlankCell] = FIFTEEN_PUZZLE_BLANK;
      blankCell = currentBlankCell;
      if (result === -1) {
        return -1;
      }
      heuristic.update(cells, tile, currentBlankCell, tileCell);
      nextBound = Math.min(nextBound, result);
    }

    return nextBound;
  }

  let bound = heuristic.reset(cells);
  try {
    for (;;) {
      const result = search(0, bound, -1);
      if (result === -1) {
        return {
          status: "solved",
          optimalMoveCount: solvedDepth,
          expandedNodeCount,
        };
      }
      bound = result;
    }
  } catch (error) {
    if (error instanceof NodeLimitExceeded) {
      return { status: "limit-exceeded", expandedNodeCount };
    }
    throw error;
  }
}

export const _private = {
  createFifteenPuzzleManhattanLinearConflictHeuristic,
};
