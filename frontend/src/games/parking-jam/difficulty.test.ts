import {
  assessParkingJamDifficulty,
  assessParkingJamReviewDifficulty,
  PARKING_JAM_LEGACY_DIFFICULTY_MODEL_VERSION,
  PARKING_JAM_REVIEW_DIFFICULTY_MODEL_VERSION,
} from "./difficulty";
import type { ParkingJamDifficultyAnalysis } from "./problem/difficulty-analysis";
import { generateParkingJamDifficultyCandidate } from "./problem/generation/difficulty-candidate-space";

const baseFeatures: ParkingJamDifficultyAnalysis["features"] = {
  vehicleCount: 14,
  dependencyDepth: 3,
  initialLegalVehicleCount: 8,
  initialLegalVehicleRatio: 8 / 14,
  initialAverageMinimumBlockingVehicleCount: 1.2,
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

const smallHardAnalysis = generateParkingJamDifficultyCandidate(
  "small-hard-11-1",
  {
    width: 6,
    height: 6,
    vehicleCount: 11,
    roadOpeningCount: 4,
    roadOpeningSpan: 3,
    fixedAreaCount: 0,
    fixedAreaLength: 1,
    blockingPlacementProbability: 1,
  },
).difficultyAnalysis;

const sameConditionEasyAnalysis = generateParkingJamDifficultyCandidate(
  "parking-jam-r3-cross-fixed-area-simplify-0",
  {
    width: 8,
    height: 8,
    vehicleCount: 11,
    roadOpeningCount: 4,
    roadOpeningSpan: 3,
    fixedAreaCount: 0,
    fixedAreaLength: 1,
    blockingPlacementProbability: 0.5,
  },
).difficultyAnalysis;

const sameConditionHardAnalysis = generateParkingJamDifficultyCandidate(
  "parking-jam-r3-cross-fixed-area-simplify-1",
  {
    width: 8,
    height: 8,
    vehicleCount: 11,
    roadOpeningCount: 4,
    roadOpeningSpan: 3,
    fixedAreaCount: 0,
    fixedAreaLength: 1,
    blockingPlacementProbability: 0.5,
  },
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
        modelVersion: PARKING_JAM_LEGACY_DIFFICULTY_MODEL_VERSION,
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
        modelVersion: PARKING_JAM_LEGACY_DIFFICULTY_MODEL_VERSION,
      });
    });
  });
});

describe("assessParkingJamReviewDifficulty", () => {
  const ratedCases = [
    [
      "easy",
      {
        ...baseFeatures,
        initialLegalVehicleCount: 12,
        initialAverageMinimumBlockingVehicleCount: 1,
        averageExitPathLength: 1.5,
      },
    ],
    [
      "normal",
      {
        ...baseFeatures,
        initialLegalVehicleCount: 11,
        initialAverageMinimumBlockingVehicleCount: 1.25,
        averageExitPathLength: 2,
      },
    ],
    [
      "hard",
      {
        ...baseFeatures,
        initialLegalVehicleCount: 9,
        initialAverageMinimumBlockingVehicleCount: 1.5,
        averageExitPathLength: 2.5,
      },
    ],
  ] as const;

  test.each(ratedCases)(
    "初期盤面の視覚探索と局所進路の負荷に対応する難易度へ分類すること: %s",
    (expected, features) => {
      const analysis: ParkingJamDifficultyAnalysis = {
        status: "supported",
        features,
      };

      const assessment = assessParkingJamReviewDifficulty(analysis);

      expect(assessment).toMatchObject({
        status: "rated",
        modelVersion: PARKING_JAM_REVIEW_DIFFICULTY_MODEL_VERSION,
        difficulty: expected,
      });
    },
  );

  test("3特徴を等しい重みで難易度スコアへ変換すること", () => {
    const analysis: ParkingJamDifficultyAnalysis = {
      status: "supported",
      features: {
        ...baseFeatures,
        initialLegalVehicleCount: 11,
        initialAverageMinimumBlockingVehicleCount: 1.25,
        averageExitPathLength: 2,
      },
    };

    const assessment = assessParkingJamReviewDifficulty(analysis);

    expect(assessment).toMatchObject({
      status: "rated",
      modelVersion: PARKING_JAM_REVIEW_DIFFICULTY_MODEL_VERSION,
      difficulty: "normal",
      factors: {
        initialBlockedVehicleCount: 3,
        initialAverageMinimumBlockingVehicleCount: 1.25,
        averageExitPathLength: 2,
      },
    });
    expect(assessment.score).toBeCloseTo(4 / 9);
  });

  test("小さい問題をhardかつ大きい問題をeasyに分類できること", () => {
    const smallAssessment = assessParkingJamReviewDifficulty(smallHardAnalysis);
    const largeAssessment = assessParkingJamReviewDifficulty(
      sameConditionEasyAnalysis,
    );

    expect(smallAssessment).toMatchObject({
      status: "rated",
      difficulty: "hard",
    });
    expect(largeAssessment).toMatchObject({
      status: "rated",
      difficulty: "easy",
    });
  });

  test("同じ生成条件から異なる難易度を分類できること", () => {
    const easyAssessment = assessParkingJamReviewDifficulty(
      sameConditionEasyAnalysis,
    );
    const hardAssessment = assessParkingJamReviewDifficulty(
      sameConditionHardAnalysis,
    );

    expect(easyAssessment).toMatchObject({
      status: "rated",
      difficulty: "easy",
    });
    expect(hardAssessment).toMatchObject({
      status: "rated",
      difficulty: "hard",
    });
  });

  test("判定対象外の状態空間特徴が変わっても難易度を変えないこと", () => {
    const features = {
      ...baseFeatures,
      initialLegalVehicleCount: 11,
      initialAverageMinimumBlockingVehicleCount: 1.25,
      averageExitPathLength: 2,
    };
    const first: ParkingJamDifficultyAnalysis = {
      status: "supported",
      features: {
        ...features,
        maximumVehicleBlockingInDegree: 1,
        maximumVehicleBlockingOutDegree: 1,
        maximumForcedChoiceChainLength: 1,
      },
    };
    const second: ParkingJamDifficultyAnalysis = {
      status: "supported",
      features: {
        ...features,
        maximumVehicleBlockingInDegree: 6,
        maximumVehicleBlockingOutDegree: 6,
        maximumForcedChoiceChainLength: 10,
      },
    };

    const firstAssessment = assessParkingJamReviewDifficulty(first);
    const secondAssessment = assessParkingJamReviewDifficulty(second);

    expect(firstAssessment).toEqual(secondAssessment);
  });

  test("全状態解析を使えない問題も初期盤面特徴から評価すること", () => {
    const analysis: ParkingJamDifficultyAnalysis = {
      status: "unsupported",
      features: {
        ...baseFeatures,
        initialLegalVehicleCount: 11,
        initialAverageMinimumBlockingVehicleCount: 1.25,
        averageExitPathLength: 2,
        legalOrderCount: null,
        solutionOrderFreedom: null,
        reachableStateCount: null,
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

    const assessment = assessParkingJamReviewDifficulty(analysis);

    expect(assessment).toMatchObject({
      status: "rated",
      difficulty: "normal",
      modelVersion: PARKING_JAM_REVIEW_DIFFICULTY_MODEL_VERSION,
    });
  });
});
