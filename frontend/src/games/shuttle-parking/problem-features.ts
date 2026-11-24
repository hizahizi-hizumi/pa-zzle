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

/** 始めたときの盤面を見れば分かる、問題の特徴。乗客の人数は3人乗りの台数と同じ量なので、台数は持たない。 */
export type ShuttleParkingProblemFeatures = {
  lotSize: number;
  bayCount: number;
  passengerCount: number;
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
  return {
    lotSize: problem.lot.size,
    bayCount: problem.bayCount,
    passengerCount: problem.passengers.length,
  };
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
  {
    id: "passenger-count",
    getValue({ passengerCount }) {
      return createCountFeatureValue(passengerCount);
    },
  },
] as const satisfies readonly ProblemFeatureAxis<ShuttleParkingProblemFeatures>[];

export type ShuttleParkingProblemFeatureAxisId =
  (typeof shuttleParkingProblemFeatureAxes)[number]["id"];
