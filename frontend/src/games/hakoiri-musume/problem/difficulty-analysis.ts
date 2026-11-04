import {
  countHakoiriMusumeEmptyCells,
  createHakoiriMusumeComponentGraph,
  type HakoiriMusumeStateMeasures,
  measureHakoiriMusumeStateGraph,
} from "@/games/hakoiri-musume/problem/generation/state-space";
import type { HakoiriMusumeProblem } from "@/games/hakoiri-musume/problem/problem";
import { formatHakoiriMusumeBoard } from "@/games/hakoiri-musume/puzzle/board";

/**
 * 難易度の判定に使う、問題の特徴。準備の長さ・娘の遠回り・誘いの局面・娘の手は、最短解の中で値が最も少ない解で数える。
 * - `optimalMoveCount`: 最短手数（同じ駒を続けて動かした移動を1手）。分類には使わず、提供範囲の下限・上限にだけ使う。
 * - `preparationLength`: 準備の長さ。娘を動かさずに続ける手の連続の最長。分類の主のつまみ。
 * - `daughterDetourCount`: 娘の遠回り。娘の左上と出口の前のマンハッタン距離が増える手の数。
 * - `emptyCellCount`: 空きマスの数（規模）。
 * - `lureCount`・`daughterMoveCount`・`optimalFirstMoveCount`・`firstMoveCount`: 記録だけ。
 *   誘いの局面の数、娘を動かす手の数、最短手数を縮める初手の数、初手の合法手の数。
 */
export type HakoiriMusumeDifficultyFeatures = {
  optimalMoveCount: number;
  preparationLength: number;
  daughterDetourCount: number;
  emptyCellCount: number;
  lureCount: number;
  daughterMoveCount: number;
  optimalFirstMoveCount: number;
  firstMoveCount: number;
};

/**
 * 問題の分析結果。盤面が小さく全局面を数え切れるので、評価できない問題は無い。
 * 娘を出口の前へ運べない問題は `invalid`（成立しない）。
 */
export type HakoiriMusumeDifficultyAnalysis =
  | { status: "analyzed"; features: HakoiriMusumeDifficultyFeatures }
  | { status: "invalid"; reason: "unreachable-exit" };

/** 状態の集まりの特徴から、`index` の盤面の特徴を取り出す。 */
export function readHakoiriMusumeDifficultyFeatures(
  measures: HakoiriMusumeStateMeasures,
  index: number,
  emptyCellCount: number,
): HakoiriMusumeDifficultyFeatures {
  return {
    optimalMoveCount: measures.optimal[index]!,
    preparationLength: measures.preparation[index]!,
    daughterDetourCount: measures.detour[index]!,
    emptyCellCount,
    lureCount: measures.lure[index]!,
    daughterMoveCount: measures.daughterMoves[index]!,
    optimalFirstMoveCount: measures.optimalFirstMoves[index]!,
    firstMoveCount: measures.firstMoves[index]!,
  };
}

/** 問題の始めの盤面から行ける全局面をたどり、特徴を求める。 */
export function analyzeHakoiriMusumeDifficulty(
  problem: HakoiriMusumeProblem,
): HakoiriMusumeDifficultyAnalysis {
  const start = formatHakoiriMusumeBoard(problem.pieces);
  const graph = createHakoiriMusumeComponentGraph(start);
  const measures = measureHakoiriMusumeStateGraph(graph);
  const index = graph.indexByBoard.get(start)!;
  if (measures.optimal[index]! < 0) {
    return { status: "invalid", reason: "unreachable-exit" };
  }
  return {
    status: "analyzed",
    features: readHakoiriMusumeDifficultyFeatures(
      measures,
      index,
      countHakoiriMusumeEmptyCells(start),
    ),
  };
}
