import {
  assessParkingJamDifficulty,
  PARKING_JAM_DIFFICULTY_MODEL_VERSION,
} from "./difficulty";
import type { ParkingJamDifficultyAnalysis } from "./problem/difficulty-analysis";

describe("assessParkingJamDifficulty", () => {
  const baseFeatures: ParkingJamDifficultyAnalysis["features"] = {
    dependencyDepth: 3,
    initialLegalVehicleCount: 8,
    initialLegalVehicleRatio: 8 / 14,
    vehicleBlockingEdgeCount: 14,
    availableExitDirectionCount: 20,
    initialBlockedExitDirectionCount: 11,
    initialBlockedExitDirectionRatio: 0.55,
    legalOrderCount: "1000000",
    solutionOrderFreedom: 0.86,
  };
  const ratedCases = [
    [
      "easy",
      {
        ...baseFeatures,
        dependencyDepth: 2,
        initialLegalVehicleRatio: 0.8,
        initialBlockedExitDirectionRatio: 0.45,
        solutionOrderFreedom: 0.93,
      },
    ],
    ["normal", baseFeatures],
    [
      "hard",
      {
        ...baseFeatures,
        dependencyDepth: 5,
        initialLegalVehicleRatio: 0.7,
        solutionOrderFreedom: 0.84,
      },
    ],
    [
      "hard",
      {
        ...baseFeatures,
        dependencyDepth: 3,
        initialLegalVehicleRatio: 0.5,
        solutionOrderFreedom: 0.74,
      },
    ],
  ] as const;

  test.each(ratedCases)(
    "特徴量に対応する難易度へ分類すること: %s",
    (expected, features) => {
      const analysis: ParkingJamDifficultyAnalysis = {
        status: "supported",
        features,
      };

      const assessment = assessParkingJamDifficulty(analysis);

      expect(assessment).toEqual({
        status: "rated",
        modelVersion: PARKING_JAM_DIFFICULTY_MODEL_VERSION,
        difficulty: expected,
      });
    },
  );

  describe("解順自由度を厳密計測できない問題の場合", () => {
    const analysis: ParkingJamDifficultyAnalysis = {
      status: "unsupported",
      features: {
        ...baseFeatures,
        legalOrderCount: null,
        solutionOrderFreedom: null,
      },
    };

    test("評価不能として返すこと", () => {
      const assessment = assessParkingJamDifficulty(analysis);

      expect(assessment).toEqual({
        status: "unsupported",
        modelVersion: PARKING_JAM_DIFFICULTY_MODEL_VERSION,
      });
    });
  });
});
