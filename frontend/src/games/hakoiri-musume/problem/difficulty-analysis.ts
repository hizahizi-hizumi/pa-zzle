import {
  countHakoiriMusumeEmptyCells,
  createHakoiriMusumeComponentGraph,
  type HakoiriMusumeStateMeasures,
  measureHakoiriMusumeStateGraph,
} from "@/games/hakoiri-musume/problem/generation/state-space";
import type { HakoiriMusumeProblem } from "@/games/hakoiri-musume/problem/problem";
import { formatHakoiriMusumeBoard } from "@/games/hakoiri-musume/puzzle/board";

/**
 * 難易度の判定に使う、問題の特徴。準備の長さと娘の遠回りはどんな長さの解でもよく（同じ1つの解の上で数える）、誘いの局面・娘の手は最短解の中で、
 * 値が最も少ない解で数える（`HakoiriMusumeStateMeasures`）。
 * - `optimalMoveCount`: 最短手数（同じ駒を続けて動かした移動を1手）。分類には使わず、提供範囲の下限・上限にだけ使う。
 * - `preparationLength`: 準備の長さ。娘が出口へ近づき、直前の前進の距離を下回り、その後二度と戻らない距離（1手の途中を含む）へ出る手と手のあいだに要る手の数の最長。
 *   分類の主のつまみ。
 * - `shortestPreparationLength`: 最短の解だけで数えた準備の長さ。最短手数と比べて、準備の長さが作業の量の言い換えになって
 *   いないかを確かめる。
 * - `daughterDetourCount`: 娘の遠回り。準備の長さを最も小さくする解の中で、娘の左上と出口の前のマンハッタン距離が増える手が
 *   最も少ない解の、その手の数。`HAKOIRI_MUSUME_COUNTED_DETOUR_LIMIT` を超える回数は、その1つ上にまとめる。
 * - `emptyCellCount`: 空きマスの数（規模）。
 * - `lureCount`・`daughterMoveCount`・`optimalFirstMoveCount`・`firstMoveCount`: 記録だけ。
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
    shortestPreparationLength: measures.shortestPreparation[index]!,
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
