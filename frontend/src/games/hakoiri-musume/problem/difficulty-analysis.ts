import {
  createHakoiriMusumeGeneralGraph,
  measureHakoiriMusumeGeneralGraph,
} from "@/games/hakoiri-musume/problem/generation/general-measure";
import { createHakoiriMusumeProblemSpace } from "@/games/hakoiri-musume/problem/generation/general-space";
import type { HakoiriMusumeProblem } from "@/games/hakoiri-musume/problem/problem";
import {
  countHakoiriMusumeCells,
  listHakoiriMusumePieceCells,
} from "@/games/hakoiri-musume/puzzle/board";

/**
 * 誘いの局面・娘の手は、最短解の中で値が最も少ない解で数える（`HakoiriMusumeGeneralMeasures`）。
 * - `daughterDetourCount`: `HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT` を超える回数は、その1つ上にまとめる。
 * - `emptyCellCount`: 壁は入れない。
 * - `lureCount`・`daughterMoveCount`・`optimalFirstMoveCount`・`firstMoveCount`: 分類には使わず、記録だけする。
 *   誘いの局面の数、娘を動かす手の数、最短手数を縮める初手の数、初手の合法手の数。
 */
export type HakoiriMusumeDifficultyFeatures = {
  optimalMoveCount: number;
  preparationLength: number;
  shortestPreparationLength: number;
  daughterDetourCount: number;
  emptyCellCount: number;
  lureCount: number;
  daughterMoveCount: number;
  optimalFirstMoveCount: number;
  firstMoveCount: number;
};

/** 全局面の分析（`HakoiriMusumeGeneralMeasures`）が持つ。 */
type HakoiriMusumeMeasuredStates = {
  optimal: ArrayLike<number>;
  preparation: ArrayLike<number>;
  shortestPreparation: ArrayLike<number>;
  detour: ArrayLike<number>;
  lure: ArrayLike<number>;
  daughterMoves: ArrayLike<number>;
  optimalFirstMoves: ArrayLike<number>;
  firstMoves: ArrayLike<number>;
};

/** 盤のマスが 32 を超える盤（6 × 6）は全局面を数え切れないので `unsupported` にする。 */
export type HakoiriMusumeDifficultyAnalysis =
  | { status: "analyzed"; features: HakoiriMusumeDifficultyFeatures }
  | { status: "unsupported"; reason: "unsupported-board" }
  | { status: "invalid"; reason: "unreachable-exit" };

export function readHakoiriMusumeDifficultyFeatures(
  measures: HakoiriMusumeMeasuredStates,
  index: number,
  emptyCellCount: number,
): HakoiriMusumeDifficultyFeatures {
  return {
    optimalMoveCount: measures.optimal[index]!,
    preparationLength: measures.preparation[index]!,
    shortestPreparationLength: measures.shortestPreparation[index]!,
    daughterDetourCount: measures.detour[index]!,
    emptyCellCount,
    lureCount: measures.lure[index]!,
    daughterMoveCount: measures.daughterMoves[index]!,
    optimalFirstMoveCount: measures.optimalFirstMoves[index]!,
    firstMoveCount: measures.firstMoves[index]!,
  };
}

/** 壁は入れない。 */
export function countHakoiriMusumeProblemEmptyCells({
  layout,
  pieces,
}: HakoiriMusumeProblem): number {
  return (
    countHakoiriMusumeCells(layout) -
    layout.walls.length -
    pieces.reduce(
      (sum, piece) => sum + listHakoiriMusumePieceCells(layout, piece).length,
      0,
    )
  );
}

/** 始めの盤面から行ける全局面をたどる。 */
export function analyzeHakoiriMusumeDifficulty(
  problem: HakoiriMusumeProblem,
): HakoiriMusumeDifficultyAnalysis {
  if (countHakoiriMusumeCells(problem.layout) > 32) {
    return { status: "unsupported", reason: "unsupported-board" };
  }
  const { space, start } = createHakoiriMusumeProblemSpace(
    problem.layout,
    problem.pieces,
  );
  const graph = createHakoiriMusumeGeneralGraph(space, [start])!;
  const measures = measureHakoiriMusumeGeneralGraph(graph);
  if (measures.optimal[0]! < 0) {
    return { status: "invalid", reason: "unreachable-exit" };
  }
  return {
    status: "analyzed",
    features: readHakoiriMusumeDifficultyFeatures(
      measures,
      0,
      countHakoiriMusumeProblemEmptyCells(problem),
    ),
  };
}
