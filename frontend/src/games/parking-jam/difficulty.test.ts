import {
  assessParkingJamDifficulty,
  PARKING_JAM_DIFFICULTY_MODEL_VERSION,
} from "./difficulty";
import type { ParkingJamDifficultyAnalysis } from "./problem/difficulty-analysis";

describe("assessParkingJamDifficulty", () => {
  const baseFeatures: ParkingJamDifficultyAnalysis["features"] = {
    vehicleCount: 12,
    dependencyDepth: 2,
    initialLegalVehicleCount: 8,
    initialLegalVehicleRatio: 8 / 12,
    vehicleBlockingEdgeCount: 14,
    maximumVehicleBlockingOutDegree: 3,
    maximumVehicleBlockingInDegree: 3,
    availableExitDirectionCount: 20,
    initialBlockedExitDirectionCount: 11,
    initialBlockedExitDirectionRatio: 0.55,
    legalOrderCount: "1000000",
    solutionOrderFreedom: 0.86,
    reachableStateCount: 128,
    averageLegalVehicleRatio: 0.8,
    minimumLegalVehicleRatio: 0.5,
    forcedChoiceStateRatio: 0.01,
    averageLegalDirectionCount: 1.2,
    averageNewlyUnlockedVehicleCount: 0.5,
    maximumNewlyUnlockedVehicleCount: 3,
    requiredPrecedenceCount: 4,
    maximumRequiredPredecessorCount: 2,
    vehicleCellOccupancyRatio: 0.5,
    longVehicleRatio: 0.25,
    roadOpeningCoverageRatio: 0.25,
    averageExitPathLength: 3,
    maximumExitPathLength: 6,
  };
  const ratedCases = [
    [
      "easy",
      {
        ...baseFeatures,
        vehicleCount: 8,
        dependencyDepth: 2,
        averageLegalVehicleRatio: 0.9,
        requiredPrecedenceCount: 1,
        maximumRequiredPredecessorCount: 1,
        solutionOrderFreedom: 0.93,
      },
    ],
    ["normal", baseFeatures],
    [
      "normal",
      {
        ...baseFeatures,
        vehicleCount: 14,
        averageLegalVehicleRatio: 0.9,
        requiredPrecedenceCount: 1,
        maximumRequiredPredecessorCount: 1,
        solutionOrderFreedom: 0.94,
      },
    ],
    [
      "hard",
      {
        ...baseFeatures,
        vehicleCount: 8,
        dependencyDepth: 4,
        averageLegalVehicleRatio: 0.65,
        minimumLegalVehicleRatio: 0.25,
        requiredPrecedenceCount: 9,
        maximumRequiredPredecessorCount: 4,
        solutionOrderFreedom: 0.72,
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

  describe("解順空間を厳密計測できない問題の場合", () => {
    const analysis: ParkingJamDifficultyAnalysis = {
      status: "unsupported",
      features: {
        ...baseFeatures,
        legalOrderCount: null,
        solutionOrderFreedom: null,
        reachableStateCount: null,
        averageLegalVehicleRatio: null,
        minimumLegalVehicleRatio: null,
        forcedChoiceStateRatio: null,
        averageLegalDirectionCount: null,
        averageNewlyUnlockedVehicleCount: null,
        maximumNewlyUnlockedVehicleCount: null,
        requiredPrecedenceCount: null,
        maximumRequiredPredecessorCount: null,
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
