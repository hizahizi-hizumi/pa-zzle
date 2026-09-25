import { getSlidePuzzleNeighborCells } from "@/games/slide-puzzle/problem/generation/solver";
import {
  createSolvedSlidePuzzleBoard,
  type SlidePuzzleBoard,
} from "@/games/slide-puzzle/puzzle/state";

/** 全状態を並べられるのは 3×3（9! = 362,880 通り）だけ。 */
const ALL_STATE_BOARD_SIZE = 3;
const CELL_COUNT = ALL_STATE_BOARD_SIZE * ALL_STATE_BOARD_SIZE;
const UNREACHABLE = 0xff;

/**
 * 3×3 の全配置について、完成盤面からの最短手数を持つ表。
 * 配置は辞書順の順位で引き、完成盤面へ到達できない配置は `null` になる。
 */
export type SlidePuzzleAllStateDistances = {
  distanceOf(board: SlidePuzzleBoard): number | null;
  /** 最短手数ごとの配置数。添字が最短手数。 */
  countsByDistance: readonly number[];
};

const factorials = Array.from({ length: CELL_COUNT + 1 }, (_, n) =>
  Array.from({ length: n }, (_, index) => index + 1).reduce(
    (product, value) => product * value,
    1,
  ),
);

function rankOf(cells: ArrayLike<number>): number {
  let rank = 0;
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const value = cells[index] ?? 0;
    let smallerLaterCount = 0;
    for (let later = index + 1; later < CELL_COUNT; later += 1) {
      if ((cells[later] ?? 0) < value) {
        smallerLaterCount += 1;
      }
    }
    rank += smallerLaterCount * (factorials[CELL_COUNT - 1 - index] ?? 0);
  }
  return rank;
}

function writeUnranked(rank: number, cells: Uint8Array): void {
  const remaining = Array.from({ length: CELL_COUNT }, (_, value) => value);
  let rest = rank;
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const factorial = factorials[CELL_COUNT - 1 - index] ?? 1;
    const position = Math.floor(rest / factorial);
    rest %= factorial;
    cells[index] = remaining.splice(position, 1)[0] ?? 0;
  }
}

/** 完成盤面から幅優先探索で全配置をたどる。構築は 1 秒ほどで終わる。 */
export function buildSlidePuzzleAllStateDistances(): SlidePuzzleAllStateDistances {
  const neighborCells = getSlidePuzzleNeighborCells(ALL_STATE_BOARD_SIZE);
  const distances = new Uint8Array(factorials[CELL_COUNT] ?? 0).fill(
    UNREACHABLE,
  );
  const queue = new Int32Array(distances.length);
  const cells = new Uint8Array(CELL_COUNT);
  const goalRank = rankOf(createSolvedSlidePuzzleBoard(ALL_STATE_BOARD_SIZE));
  distances[goalRank] = 0;
  queue[0] = goalRank;
  let queueLength = 1;
  const countsByDistance: number[] = [];

  for (let head = 0; head < queueLength; head += 1) {
    const rank = queue[head] ?? 0;
    const distance = distances[rank] ?? 0;
    countsByDistance[distance] = (countsByDistance[distance] ?? 0) + 1;
    writeUnranked(rank, cells);
    const blankCell = cells.indexOf(0);
    for (const cell of neighborCells[blankCell] ?? []) {
      cells[blankCell] = cells[cell] ?? 0;
      cells[cell] = 0;
      const nextRank = rankOf(cells);
      if (distances[nextRank] === UNREACHABLE) {
        distances[nextRank] = distance + 1;
        queue[queueLength] = nextRank;
        queueLength += 1;
      }
      cells[cell] = cells[blankCell] ?? 0;
      cells[blankCell] = 0;
    }
  }

  return {
    distanceOf(board) {
      if (board.length !== CELL_COUNT) {
        throw new RangeError("All-state distances are only for 3×3 boards");
      }
      const distance = distances[rankOf(board)] ?? UNREACHABLE;
      return distance === UNREACHABLE ? null : distance;
    },
    countsByDistance,
  };
}
