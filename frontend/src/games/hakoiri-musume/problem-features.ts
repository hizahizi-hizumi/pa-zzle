import type { HakoiriMusumeDifficulty } from "@/games/hakoiri-musume/difficulty";
import { findHakoiriMusumePoolEntryByProblemId } from "@/games/hakoiri-musume/problem/problem-pool";
import {
  type HakoiriMusumePieceKind,
  parseHakoiriMusumeBoard,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  createCountFeatureValue,
  type ProblemFeatureAxis,
} from "@/games/problem-feature";

/** 始めたときの盤面を見れば分かる、問題の特徴。 */
export type HakoiriMusumeProblemFeatures = {
  horizontalCount: number;
  smallCount: number;
};

/** 難易度の問題集の1問の特徴を、問題集の盤面の20文字から求める。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findHakoiriMusumePoolProblemFeatures(
  difficulty: HakoiriMusumeDifficulty,
  problemId: string,
): HakoiriMusumeProblemFeatures | null {
  const entry = findHakoiriMusumePoolEntryByProblemId(difficulty, problemId);
  const pieces = entry ? parseHakoiriMusumeBoard(entry[0]) : null;
  if (!pieces) {
    return null;
  }
  const kinds = pieces.map((piece) => piece.kind);
  function countKind(kind: HakoiriMusumePieceKind): number {
    return kinds.filter((pieceKind) => pieceKind === kind).length;
  }
  return {
    horizontalCount: countKind("horizontal"),
    smallCount: countKind("small"),
  };
}

/** 図鑑の絞り込みで問題を分ける特徴の軸。最短手数は解かないと分からないので軸にしない。 */
export const hakoiriMusumeProblemFeatureAxes = [
  {
    id: "horizontal-count",
    getValue({ horizontalCount }) {
      return createCountFeatureValue(horizontalCount);
    },
  },
  {
    id: "small-count",
    getValue({ smallCount }) {
      return createCountFeatureValue(smallCount);
    },
  },
] as const satisfies readonly ProblemFeatureAxis<HakoiriMusumeProblemFeatures>[];

export type HakoiriMusumeProblemFeatureAxisId =
  (typeof hakoiriMusumeProblemFeatureAxes)[number]["id"];
