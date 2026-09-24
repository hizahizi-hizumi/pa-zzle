import { getMinesweeperCellCount } from "../puzzle/board";
import { collectMinesweeperRevealCellIndices } from "../puzzle/rules";
import type { MinesweeperProblem } from "./problem";

// 最大盤面サイズを比較するための仮問題。No Guess は保証しない。
const MIN_BOARD_SIZE = 5;
const MAX_BOARD_SIZE = 30;
const MINE_DENSITY = 0.16;
const MINE_PLACEMENT_SEED = 20260924;

export type MinesweeperBoardSizeReviewSize = {
  rows: number;
  columns: number;
};

function parseBoardLength(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) {
    return null;
  }
  const length = Number(value);
  return length >= MIN_BOARD_SIZE && length <= MAX_BOARD_SIZE ? length : null;
}

export function parseMinesweeperBoardSizeReviewSize(
  rowsParam: string | null,
  columnsParam: string | null,
): MinesweeperBoardSizeReviewSize | null {
  const rows = parseBoardLength(rowsParam);
  const columns = parseBoardLength(columnsParam);
  if (rows === null || columns === null) {
    return null;
  }
  return { rows, columns };
}

// mulberry32: 盤面比較で毎回同じ配置を再現するための簡易PRNG。
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function getCenterSafeCellIndices({
  rows,
  columns,
}: MinesweeperBoardSizeReviewSize): Set<number> {
  const centerRow = Math.floor(rows / 2);
  const centerColumn = Math.floor(columns / 2);
  const cellIndices = new Set<number>();
  for (let row = centerRow - 1; row <= centerRow + 1; row += 1) {
    for (
      let column = centerColumn - 1;
      column <= centerColumn + 1;
      column += 1
    ) {
      cellIndices.add(row * columns + column);
    }
  }
  return cellIndices;
}

export function createMinesweeperBoardSizeReviewProblem(
  size: MinesweeperBoardSizeReviewSize,
): MinesweeperProblem {
  const cellCount = getMinesweeperCellCount({ ...size, mineCellIndices: [] });
  const centerSafeCellIndices = getCenterSafeCellIndices(size);
  const candidates = Array.from(
    { length: cellCount },
    (_, cellIndex) => cellIndex,
  ).filter((cellIndex) => !centerSafeCellIndices.has(cellIndex));

  const nextRandom = createSeededRandom(MINE_PLACEMENT_SEED);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [
      candidates[swapIndex]!,
      candidates[index]!,
    ];
  }

  const mineCount = Math.round(cellCount * MINE_DENSITY);
  const board = {
    ...size,
    mineCellIndices: candidates
      .slice(0, mineCount)
      .sort((left, right) => left - right),
  };
  const centerCellIndex =
    Math.floor(size.rows / 2) * size.columns + Math.floor(size.columns / 2);

  return {
    board,
    initialRevealedCellIndices: collectMinesweeperRevealCellIndices(board, [
      centerCellIndex,
    ]),
  };
}
