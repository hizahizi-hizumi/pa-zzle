import type { IceFloorMazeDifficulty } from "@/games/ice-floor-maze/difficulty";
import {
  findIceFloorMazePoolEntryByProblemId,
  restoreIceFloorMazePoolEntry,
} from "@/games/ice-floor-maze/problem/problem-pool";
import {
  createBoardSizeFeatureValue,
  createCountFeatureValue,
  type ProblemFeatureAxis,
} from "@/games/problem-feature";

/** 始めたときの盤面を見れば分かる、問題の特徴。盤面は盤面の外を切り落とした外接の長方形の行と列の数。 */
export type IceFloorMazeProblemFeatures = {
  rows: number;
  columns: number;
  brittleRockCount: number;
  thinIceCount: number;
};

/** 難易度の問題集の1問の特徴を、問題集の盤面の符号から求める。問題集に無い ID・別の難易度の ID には `null` を返す。 */
export function findIceFloorMazePoolProblemFeatures(
  difficulty: IceFloorMazeDifficulty,
  problemId: string,
): IceFloorMazeProblemFeatures | null {
  const entry = findIceFloorMazePoolEntryByProblemId(difficulty, problemId);
  if (!entry) {
    return null;
  }
  const { board } = restoreIceFloorMazePoolEntry(entry).problem;
  return {
    rows: board.height,
    columns: board.width,
    brittleRockCount: board.cells.filter((cell) => cell === "brittle-rock")
      .length,
    thinIceCount: board.cells.filter((cell) => cell === "thin-ice").length,
  };
}

/** 図鑑の絞り込みで問題を分ける特徴の軸。最短手数は解かないと分からないので軸にしない。 */
export const iceFloorMazeProblemFeatureAxes = [
  {
    id: "board-size",
    getValue({ rows, columns }) {
      return createBoardSizeFeatureValue(rows, columns);
    },
  },
  {
    id: "brittle-rock-count",
    getValue({ brittleRockCount }) {
      return createCountFeatureValue(brittleRockCount);
    },
  },
  {
    id: "thin-ice-count",
    getValue({ thinIceCount }) {
      return createCountFeatureValue(thinIceCount);
    },
  },
] as const satisfies readonly ProblemFeatureAxis<IceFloorMazeProblemFeatures>[];

export type IceFloorMazeProblemFeatureAxisId =
  (typeof iceFloorMazeProblemFeatureAxes)[number]["id"];
