import {
  createBoardSizeFeatureValue,
  createCountFeatureValue,
  type ProblemFeatureAxis,
} from "@/games/problem-feature";
import type { ShuttleParkingDifficulty } from "@/games/shuttle-parking/difficulty";
import {
  findShuttleParkingPoolEntryByProblemId,
  restoreShuttleParkingPoolEntry,
} from "@/games/shuttle-parking/problem/problem-pool";

/** 始めたときの盤面を見れば分かる、問題の特徴。 */
export type ShuttleParkingProblemFeatures = {
  lotSize: number;
  bayCount: number;
};

export function findShuttleParkingPoolProblemFeatures(
  difficulty: ShuttleParkingDifficulty,
  problemId: string,
): ShuttleParkingProblemFeatures | null {
  const entry = findShuttleParkingPoolEntryByProblemId(difficulty, problemId);
  if (!entry) {
    return null;
  }
  const { problem } = restoreShuttleParkingPoolEntry(entry);
  return { lotSize: problem.lot.size, bayCount: problem.bayCount };
}

export const shuttleParkingProblemFeatureAxes = [
  {
    id: "lot-size",
    getValue({ lotSize }) {
      return createBoardSizeFeatureValue(lotSize, lotSize);
    },
  },
  {
    id: "bay-count",
    getValue({ bayCount }) {
      return createCountFeatureValue(bayCount);
    },
  },
] as const satisfies readonly ProblemFeatureAxis<ShuttleParkingProblemFeatures>[];

export type ShuttleParkingProblemFeatureAxisId =
  (typeof shuttleParkingProblemFeatureAxes)[number]["id"];
