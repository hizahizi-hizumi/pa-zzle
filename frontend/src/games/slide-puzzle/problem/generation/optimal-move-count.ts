import { buildSlidePuzzleAllStateDistances } from "@/games/slide-puzzle/problem/generation/all-state-distances";
import {
  buildSlidePuzzlePatternDatabase,
  createSlidePuzzlePatternDatabaseHeuristic,
} from "@/games/slide-puzzle/problem/generation/pattern-database";
import { solveSlidePuzzleOptimally } from "@/games/slide-puzzle/problem/generation/solver";
import type {
  SlidePuzzleBoard,
  SlidePuzzleBoardSize,
} from "@/games/slide-puzzle/puzzle/state";

type SlidePuzzleOptimalMoveCounterOptions = {
  /** 1 問あたりに展開するノード数の上限。3×3 は表を引くので使わない。 */
  nodeLimit?: number;
};

/** 最短手数を返す。探索が上限に達して求められなかった盤面では `null` を返す。 */
export type SlidePuzzleOptimalMoveCounter = (
  board: SlidePuzzleBoard,
) => number | null;

/**
 * 盤面サイズに合う方法で最短手数を求める関数を作る。
 * 3×3 は全状態の表を引き、4×4・5×5 はパターンデータベースを下界にした IDA* で探す。
 * 5×5 のパターンデータベースは構築に数分・数百 MB を使うので、問題集の事前生成と分析だけで作る。
 */
export function createSlidePuzzleOptimalMoveCounter(
  boardSize: SlidePuzzleBoardSize,
  { nodeLimit }: SlidePuzzleOptimalMoveCounterOptions = {},
): SlidePuzzleOptimalMoveCounter {
  if (boardSize === 3) {
    const allStateDistances = buildSlidePuzzleAllStateDistances();
    return (board) => allStateDistances.distanceOf(board);
  }

  const heuristic = createSlidePuzzlePatternDatabaseHeuristic(
    buildSlidePuzzlePatternDatabase(boardSize),
  );
  return (board) => {
    const solved = solveSlidePuzzleOptimally(board, { heuristic, nodeLimit });
    return solved.status === "solved" ? solved.optimalMoveCount : null;
  };
}
