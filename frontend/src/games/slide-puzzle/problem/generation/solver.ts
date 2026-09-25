import { isSolvableSlidePuzzleBoard } from "@/games/slide-puzzle/puzzle/rules";
import {
  getSlidePuzzleBoardSize,
  getSlidePuzzleColumn,
  getSlidePuzzleRow,
  isSlidePuzzleSolved,
  SLIDE_PUZZLE_BLANK,
  type SlidePuzzleBoard,
  type SlidePuzzleBoardSize,
} from "@/games/slide-puzzle/puzzle/state";

/**
 * IDA* が使う許容的な下界。探索中は盤面を書き換えながら差分で更新する。
 */
export type SlidePuzzleHeuristic = {
  /** 下界を求められる盤面の一辺のマス数。 */
  boardSize: SlidePuzzleBoardSize;
  /** 盤面全体から下界を求め、差分更新の内部状態を作り直す。 */
  reset(cells: Uint8Array): number;
  /** `cells` は移動後の盤面。`tile` が `from` から `to` へ動いた後の下界を返す。 */
  update(cells: Uint8Array, tile: number, from: number, to: number): number;
};

type SlidePuzzleSolveOptions = {
  /** 展開するノード数の上限。正の整数で、超えたら `limit-exceeded` を返す。省略すると上限なし。 */
  nodeLimit?: number;
  heuristic?: SlidePuzzleHeuristic;
};

type SlidePuzzleSolveResult =
  | {
      status: "solved";
      optimalMoveCount: number;
      expandedNodeCount: number;
    }
  | { status: "limit-exceeded"; expandedNodeCount: number };

/** 探索で繰り返し引く、盤面サイズごとの表。 */
type SolverTables = {
  cellCount: number;
  neighborCells: readonly (readonly number[])[];
  /** `tile * cellCount + cellIndex` で引く、タイルのゴールまでの距離。 */
  tileDistances: Uint8Array;
  goalRowOfTile: Int8Array;
  goalColumnOfTile: Int8Array;
  /** 行（列）の中のタイルを、その行（列）の中のゴール順 + 1（ゴールが外なら 0）の桁として並べた値で引く線形衝突。 */
  lineConflicts: Uint8Array;
};

function createNeighborCells(
  boardSize: SlidePuzzleBoardSize,
): readonly (readonly number[])[] {
  return Array.from({ length: boardSize * boardSize }, (_, cellIndex) => {
    const row = getSlidePuzzleRow(cellIndex, boardSize);
    const column = getSlidePuzzleColumn(cellIndex, boardSize);
    return [
      row > 0 ? cellIndex - boardSize : null,
      row < boardSize - 1 ? cellIndex + boardSize : null,
      column > 0 ? cellIndex - 1 : null,
      column < boardSize - 1 ? cellIndex + 1 : null,
    ].filter((neighbor) => neighbor !== null);
  });
}

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
function createLineConflictTable(boardSize: SlidePuzzleBoardSize): Uint8Array {
  const digitBase = boardSize + 1;
  const table = new Uint8Array(digitBase ** boardSize);
  for (let key = 0; key < table.length; key += 1) {
    const goalOrders: number[] = [];
    let rest = key;
    for (let offset = 0; offset < boardSize; offset += 1) {
      const digit = rest % digitBase;
      if (digit > 0) {
        goalOrders.push(digit - 1);
      }
      rest = Math.floor(rest / digitBase);
    }
    table[key] =
      2 *
      (goalOrders.length - lengthOfLongestIncreasingSubsequence(goalOrders));
  }
  return table;
}

function createSolverTables(boardSize: SlidePuzzleBoardSize): SolverTables {
  const cellCount = boardSize * boardSize;
  const goalRowOfTile = new Int8Array(cellCount).fill(-1);
  const goalColumnOfTile = new Int8Array(cellCount).fill(-1);
  for (let tile = 1; tile < cellCount; tile += 1) {
    goalRowOfTile[tile] = getSlidePuzzleRow(tile - 1, boardSize);
    goalColumnOfTile[tile] = getSlidePuzzleColumn(tile - 1, boardSize);
  }
  const tileDistances = Uint8Array.from(
    { length: cellCount * cellCount },
    (_, key) => {
      const tile = Math.floor(key / cellCount);
      const cellIndex = key % cellCount;
      return tile === SLIDE_PUZZLE_BLANK
        ? 0
        : Math.abs(
            getSlidePuzzleRow(cellIndex, boardSize) -
              (goalRowOfTile[tile] ?? 0),
          ) +
            Math.abs(
              getSlidePuzzleColumn(cellIndex, boardSize) -
                (goalColumnOfTile[tile] ?? 0),
            );
    },
  );

  return {
    cellCount,
    neighborCells: createNeighborCells(boardSize),
    tileDistances,
    goalRowOfTile,
    goalColumnOfTile,
    lineConflicts: createLineConflictTable(boardSize),
  };
}

const solverTablesByBoardSize = new Map<SlidePuzzleBoardSize, SolverTables>();

function getSolverTables(boardSize: SlidePuzzleBoardSize): SolverTables {
  let tables = solverTablesByBoardSize.get(boardSize);
  if (!tables) {
    tables = createSolverTables(boardSize);
    solverTablesByBoardSize.set(boardSize, tables);
  }
  return tables;
}

/** 各マスから空白が 1 手で動けるマス。生成・検証の探索で共有する。 */
export function getSlidePuzzleNeighborCells(
  boardSize: SlidePuzzleBoardSize,
): readonly (readonly number[])[] {
  return getSolverTables(boardSize).neighborCells;
}

/**
 * マンハッタン距離総和 + 線形衝突（Hansson, Mayer & Yung 1992）。
 * 同じ行・列にゴールがあり、ゴールの前後が逆になっているタイルは、
 * 少なくとも一方が行・列の外へ一度出る必要がある。
 */
function createSlidePuzzleManhattanLinearConflictHeuristic(
  boardSize: SlidePuzzleBoardSize,
): SlidePuzzleHeuristic {
  const {
    cellCount,
    tileDistances,
    goalRowOfTile,
    goalColumnOfTile,
    lineConflicts,
  } = getSolverTables(boardSize);
  const digitBase = boardSize + 1;
  const rowConflicts = new Uint8Array(boardSize);
  const columnConflicts = new Uint8Array(boardSize);
  let manhattanDistance = 0;
  let conflictTotal = 0;

  function rowConflictOf(cells: Uint8Array, row: number): number {
    let key = 0;
    for (let offset = boardSize - 1; offset >= 0; offset -= 1) {
      const tile = cells[row * boardSize + offset] ?? SLIDE_PUZZLE_BLANK;
      key *= digitBase;
      if (tile !== SLIDE_PUZZLE_BLANK && goalRowOfTile[tile] === row) {
        key += (goalColumnOfTile[tile] ?? 0) + 1;
      }
    }
    return lineConflicts[key] ?? 0;
  }

  function columnConflictOf(cells: Uint8Array, column: number): number {
    let key = 0;
    for (let offset = boardSize - 1; offset >= 0; offset -= 1) {
      const tile = cells[offset * boardSize + column] ?? SLIDE_PUZZLE_BLANK;
      key *= digitBase;
      if (tile !== SLIDE_PUZZLE_BLANK && goalColumnOfTile[tile] === column) {
        key += (goalRowOfTile[tile] ?? 0) + 1;
      }
    }
    return lineConflicts[key] ?? 0;
  }

  return {
    boardSize,
    reset(cells) {
      manhattanDistance = 0;
      for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
        manhattanDistance +=
          tileDistances[(cells[cellIndex] ?? 0) * cellCount + cellIndex] ?? 0;
      }
      conflictTotal = 0;
      for (let line = 0; line < boardSize; line += 1) {
        rowConflicts[line] = rowConflictOf(cells, line);
        columnConflicts[line] = columnConflictOf(cells, line);
        conflictTotal +=
          (rowConflicts[line] ?? 0) + (columnConflicts[line] ?? 0);
      }
      return manhattanDistance + conflictTotal;
    },
    update(cells, tile, from, to) {
      const tileOffset = tile * cellCount;
      manhattanDistance +=
        (tileDistances[tileOffset + to] ?? 0) -
        (tileDistances[tileOffset + from] ?? 0);

      const fromRow = getSlidePuzzleRow(from, boardSize);
      const toRow = getSlidePuzzleRow(to, boardSize);
      if (fromRow === toRow) {
        // 横に動いたタイルは、行の中の順序を変えず、列だけを移る。
        for (const column of [
          getSlidePuzzleColumn(from, boardSize),
          getSlidePuzzleColumn(to, boardSize),
        ]) {
          const next = columnConflictOf(cells, column);
          conflictTotal += next - (columnConflicts[column] ?? 0);
          columnConflicts[column] = next;
        }
      } else {
        for (const row of [fromRow, toRow]) {
          const next = rowConflictOf(cells, row);
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
export function solveSlidePuzzleOptimally(
  board: SlidePuzzleBoard,
  options: SlidePuzzleSolveOptions = {},
): SlidePuzzleSolveResult {
  if (!isSolvableSlidePuzzleBoard(board)) {
    throw new RangeError("Slide puzzle board must be solvable");
  }
  const nodeLimit = options.nodeLimit ?? Number.POSITIVE_INFINITY;
  if (
    nodeLimit !== Number.POSITIVE_INFINITY &&
    !(Number.isInteger(nodeLimit) && nodeLimit > 0)
  ) {
    throw new RangeError("nodeLimit must be a positive integer");
  }
  const boardSize = getSlidePuzzleBoardSize(board);
  const heuristic =
    options.heuristic ??
    createSlidePuzzleManhattanLinearConflictHeuristic(boardSize);
  if (heuristic.boardSize !== boardSize) {
    throw new RangeError("heuristic must be built for the same board size");
  }
  const { neighborCells } = getSolverTables(boardSize);
  const cells = Uint8Array.from(board);
  let blankCell = cells.indexOf(SLIDE_PUZZLE_BLANK);
  let expandedNodeCount = 0;
  let solvedDepth = 0;

  if (isSlidePuzzleSolved(board)) {
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
      cells[tileCell] = SLIDE_PUZZLE_BLANK;
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
      cells[currentBlankCell] = SLIDE_PUZZLE_BLANK;
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
  createSlidePuzzleManhattanLinearConflictHeuristic,
};
