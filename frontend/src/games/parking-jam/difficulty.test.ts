import {
  assessParkingJamDifficulty,
  assessParkingJamReviewDifficulty,
  PARKING_JAM_DIFFICULTY_MODEL_VERSION,
  PARKING_JAM_REVIEW_DIFFICULTY_MODEL_VERSION,
} from "./difficulty";
import type { ParkingJamDifficultyAnalysis } from "./problem/difficulty-analysis";
import {
  generateParkingJamDifficultyCandidate,
  PARKING_JAM_DIFFICULTY_CROSS_AXIS_CASES,
} from "./problem/generation/difficulty-candidate-space";

const baseFeatures: ParkingJamDifficultyAnalysis["features"] = {
  vehicleCount: 14,
  dependencyDepth: 3,
  initialLegalVehicleCount: 8,
  initialLegalVehicleRatio: 8 / 14,
  vehicleBlockingEdgeCount: 14,
  maximumVehicleBlockingOutDegree: 3,
  maximumVehicleBlockingInDegree: 3,
  availableExitDirectionCount: 20,
  initialBlockedExitDirectionCount: 11,
  initialBlockedExitDirectionRatio: 0.55,
  legalOrderCount: "1000000",
  solutionOrderFreedom: 0.86,
  reachableStateCount: 128,
  averageLegalVehicleCount: 4.2,
  averageLegalVehicleRatio: 0.6,
  minimumLegalVehicleRatio: 0.25,
  forcedChoiceStateRatio: 0.1,
  maximumForcedChoiceChainLength: 2,
  averageMinimumBlockingVehicleCount: 1.2,
  averageLegalDirectionCount: 1.2,
  averageNewlyUnlockedVehicleCount: 0.5,
  maximumNewlyUnlockedVehicleCount: 3,
  requiredPrecedenceCount: 12,
  maximumRequiredPredecessorCount: 3,
  vehicleCellOccupancyRatio: 0.5,
  longVehicleRatio: 0.25,
  roadOpeningCoverageRatio: 0.25,
  averageExitPathLength: 3,
  maximumExitPathLength: 6,
};

const boardSizeLowerCase = PARKING_JAM_DIFFICULTY_CROSS_AXIS_CASES.find(
  (candidate) => candidate.id === "board-size-lower",
);
const boardSizeHigherCase = PARKING_JAM_DIFFICULTY_CROSS_AXIS_CASES.find(
  (candidate) => candidate.id === "board-size-higher",
);
if (!boardSizeLowerCase || !boardSizeHigherCase) {
  throw new Error("Board-size cross-axis cases must exist");
}

const crossSizeReviewSeed = "parking-jam-r3-cross-board-size-step4-3";
const smallHardAnalysis = generateParkingJamDifficultyCandidate(
  crossSizeReviewSeed,
  boardSizeLowerCase.conditions,
).difficultyAnalysis;
const largeEasyAnalysis = generateParkingJamDifficultyCandidate(
  crossSizeReviewSeed,
  boardSizeHigherCase.conditions,
).difficultyAnalysis;
const largeHardAnalysis = generateParkingJamDifficultyCandidate(
  "parking-jam-r3-cross-board-size-step4-1",
  boardSizeHigherCase.conditions,
).difficultyAnalysis;

describe("assessParkingJamDifficulty", () => {
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

describe("assessParkingJamReviewDifficulty", () => {
  const forcedChainAnalysis: ParkingJamDifficultyAnalysis = {
    status: "supported",
    features: {
      ...baseFeatures,
      averageLegalVehicleRatio: 0.5,
      averageMinimumBlockingVehicleCount: 1.45,
      vehicleCellOccupancyRatio: 0.6,
      averageExitPathLength: 2.8,
      maximumVehicleBlockingInDegree: 4,
      maximumVehicleBlockingOutDegree: 4,
      maximumForcedChoiceChainLength: 4,
    },
  };
  const unsupportedAnalysis: ParkingJamDifficultyAnalysis = {
    status: "unsupported",
    features: {
      ...baseFeatures,
      averageLegalVehicleCount: null,
      averageLegalVehicleRatio: null,
      minimumLegalVehicleRatio: null,
      forcedChoiceStateRatio: null,
      maximumForcedChoiceChainLength: null,
      averageMinimumBlockingVehicleCount: null,
      averageLegalDirectionCount: null,
      averageNewlyUnlockedVehicleCount: null,
      maximumNewlyUnlockedVehicleCount: null,
      requiredPrecedenceCount: null,
      maximumRequiredPredecessorCount: null,
    },
  };

  test("小さい問題をhardかつ大きい問題をeasyに分類できること", () => {
    const smallAssessment = assessParkingJamReviewDifficulty(smallHardAnalysis);
    const largeAssessment = assessParkingJamReviewDifficulty(largeEasyAnalysis);

    expect(smallAssessment).toMatchObject({
      status: "rated",
      modelVersion: PARKING_JAM_REVIEW_DIFFICULTY_MODEL_VERSION,
      difficulty: "hard",
    });
    expect(largeAssessment).toMatchObject({
      status: "rated",
      modelVersion: PARKING_JAM_REVIEW_DIFFICULTY_MODEL_VERSION,
      difficulty: "easy",
    });
  });

  test("同じ生成条件から異なる難易度を分類できること", () => {
    const hardAssessment = assessParkingJamReviewDifficulty(largeHardAnalysis);
    const easyAssessment = assessParkingJamReviewDifficulty(largeEasyAnalysis);

    expect(hardAssessment).toMatchObject({
      status: "rated",
      difficulty: "hard",
    });
    expect(easyAssessment).toMatchObject({
      status: "rated",
      difficulty: "easy",
    });
  });

  test("forced chainが長いことだけでhardに分類しないこと", () => {
    const assessment = assessParkingJamReviewDifficulty(forcedChainAnalysis);

    expect(assessment).toMatchObject({
      status: "rated",
      difficulty: "normal",
    });
  });

  test("全状態解析を使えない問題を評価不能として返すこと", () => {
    const assessment = assessParkingJamReviewDifficulty(unsupportedAnalysis);

    expect(assessment).toEqual({
      status: "unsupported",
      modelVersion: PARKING_JAM_REVIEW_DIFFICULTY_MODEL_VERSION,
    });
  });
});
