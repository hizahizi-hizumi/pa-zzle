import {
  calculateSlidePuzzleManhattanDistance,
  getSlidePuzzleBoardSize,
  getSlidePuzzleColumn,
  getSlidePuzzleRow,
  SLIDE_PUZZLE_BLANK,
  type SlidePuzzleBoard,
  type SlidePuzzleBoardSize,
} from "@/games/slide-puzzle/puzzle/state";

export type SlidePuzzleDifficultyFeatures = {
  /** 盤面の一辺のマス数。盤面の把握と読みの深さを強めるレバーとして難易度に使う。 */
  boardSize: SlidePuzzleBoardSize;
  /** タイル 1 枚の移動を 1 手とした最短手数。作業量の対照。 */
  optimalMoveCount: number;
  /** 各タイルを他と無関係に運べた場合の手数。盤面から見える距離。 */
  manhattanDistance: number;
  /**
   * 最短解のうち、タイルをゴールから遠ざける手の数。
   * 1 手でマンハッタン距離総和は必ず ±1 変わるので、(最短手数 − マンハッタン距離総和) / 2 に等しい。
   */
  detourMoveCount: number;
  /** ゴール位置にないタイルの枚数。撹拌の広がりの対照。 */
  misplacedTileCount: number;
  /** 同じ行・列にゴールがあり、ゴールの前後が逆になっているタイル対の数。観測用。 */
  linearConflictPairCount: number;
};

export type SlidePuzzleDifficultyAnalysis =
  | { status: "analyzed"; features: SlidePuzzleDifficultyFeatures }
  | { status: "unsupported" };

function countMisplacedTiles(board: SlidePuzzleBoard): number {
  return board.filter(
    (tile, cellIndex) => tile !== SLIDE_PUZZLE_BLANK && tile !== cellIndex + 1,
  ).length;
}

function countLinearConflictPairs(board: SlidePuzzleBoard): number {
  const boardSize = getSlidePuzzleBoardSize(board);
  let pairCount = 0;
  for (const [cellIndex, tile] of board.entries()) {
    if (tile === SLIDE_PUZZLE_BLANK) {
      continue;
    }
    const goalIndex = tile - 1;
    for (
      let laterIndex = cellIndex + 1;
      laterIndex < board.length;
      laterIndex += 1
    ) {
      const laterTile = board[laterIndex] ?? SLIDE_PUZZLE_BLANK;
      if (laterTile === SLIDE_PUZZLE_BLANK) {
        continue;
      }
      const laterGoalIndex = laterTile - 1;
      const sharesGoalRow =
        getSlidePuzzleRow(cellIndex, boardSize) ===
          getSlidePuzzleRow(laterIndex, boardSize) &&
        getSlidePuzzleRow(goalIndex, boardSize) ===
          getSlidePuzzleRow(cellIndex, boardSize) &&
        getSlidePuzzleRow(laterGoalIndex, boardSize) ===
          getSlidePuzzleRow(cellIndex, boardSize);
      const sharesGoalColumn =
        getSlidePuzzleColumn(cellIndex, boardSize) ===
          getSlidePuzzleColumn(laterIndex, boardSize) &&
        getSlidePuzzleColumn(goalIndex, boardSize) ===
          getSlidePuzzleColumn(cellIndex, boardSize) &&
        getSlidePuzzleColumn(laterGoalIndex, boardSize) ===
          getSlidePuzzleColumn(cellIndex, boardSize);
      if ((sharesGoalRow || sharesGoalColumn) && goalIndex > laterGoalIndex) {
        pairCount += 1;
      }
    }
  }
  return pairCount;
}

/**
 * 最短手数は事前生成時に solver で求めた値を受け取る。
 * 最短手数が分からない問題（solver の探索上限に達した問題）は評価不能とする。
 */
export function analyzeSlidePuzzleDifficulty(
  board: SlidePuzzleBoard,
  optimalMoveCount: number | null,
): SlidePuzzleDifficultyAnalysis {
  if (optimalMoveCount === null) {
    return { status: "unsupported" };
  }

  const manhattanDistance = calculateSlidePuzzleManhattanDistance(board);
  if (
    !Number.isInteger(optimalMoveCount) ||
    optimalMoveCount < manhattanDistance ||
    (optimalMoveCount - manhattanDistance) % 2 !== 0
  ) {
    throw new RangeError(
      "optimalMoveCount must be at least the Manhattan distance with the same parity",
    );
  }

  return {
    status: "analyzed",
    features: {
      boardSize: getSlidePuzzleBoardSize(board),
      optimalMoveCount,
      manhattanDistance,
      detourMoveCount: (optimalMoveCount - manhattanDistance) / 2,
      misplacedTileCount: countMisplacedTiles(board),
      linearConflictPairCount: countLinearConflictPairs(board),
    },
  };
}
