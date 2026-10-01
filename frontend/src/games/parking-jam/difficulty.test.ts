import {
  assessParkingJamDifficulty,
  calculateParkingJamDifficultyFactors,
  getParkingJamDifficultyLabel,
  parseParkingJamDifficulty,
  parseParkingJamRecordedDifficulty,
} from "@/games/parking-jam/difficulty";
import type {
  ParkingJamDifficultyAnalysis,
  ParkingJamDifficultyFeatures,
} from "@/games/parking-jam/problem/difficulty-analysis";

const baseFeatures: ParkingJamDifficultyFeatures = {
  vehicleCount: 8,
  boardCellCount: 64,
  fixedAreaCount: 0,
  dependencyDepth: 2,
  initialLegalVehicleCount: 5,
  initialLegalVehicleRatio: 5 / 8,
  initialAverageMinimumBlockingVehicleCount: 1,
  vehicleBlockingEdgeCount: 3,
  maximumVehicleBlockingOutDegree: 2,
  maximumVehicleBlockingInDegree: 1,
  availableExitDirectionCount: 10,
  initialBlockedExitDirectionCount: 3,
  initialBlockedExitDirectionRatio: 0.3,
  legalOrderCount: "10000",
  solutionOrderFreedom: 0.86,
  reachableStateCount: 128,
  averageLegalVehicleCount: 4.2,
  averageLegalVehicleRatio: 0.8,
  minimumLegalVehicleRatio: 0.5,
  forcedChoiceStateRatio: 0.1,
  maximumForcedChoiceChainLength: 1,
  averageMinimumBlockingVehicleCount: 1,
  averageLegalDirectionCount: 1.2,
  averageNewlyUnlockedVehicleCount: 0.5,
  maximumNewlyUnlockedVehicleCount: 2,
  requiredPrecedenceCount: 3,
  maximumRequiredPredecessorCount: 1,
  maximumPrerequisiteVehicleCount: 1,
  adjacentLaneOpeningVehicleCount: 0,
  directionChoiceVehicleCount: 0,
  farBlockedVehicleCount: 0,
  misreadInducingVehicleCount: 0,
  vehicleCellOccupancyRatio: 0.3,
  longVehicleRatio: 0.25,
  roadOpeningCoverageRatio: 0.25,
  averageExitPathLength: 2,
  maximumExitPathLength: 5,
};

function toAnalysis(
  features: Partial<ParkingJamDifficultyFeatures>,
): ParkingJamDifficultyAnalysis {
  return { status: "supported", features: { ...baseFeatures, ...features } };
}

describe("parseParkingJamDifficulty", () => {
  const cases = [
    ["1", "1"],
    ["5", "5"],
    ["6", undefined],
    ["easy", undefined],
    [undefined, undefined],
  ] as const;

  test.each(cases)(
    "URL の難易度をレベル1〜5だけに変換すること: %s",
    (value, expected) => {
      const difficulty = parseParkingJamDifficulty(value);

      expect(difficulty).toBe(expected);
    },
  );
});

describe("parseParkingJamRecordedDifficulty", () => {
  const cases = [
    ["3", "3"],
    ["hard", "hard"],
    ["expert", undefined],
  ] as const;

  test.each(cases)(
    "記録の難易度をレベルと旧3段階の両方で読むこと: %s",
    (value, expected) => {
      const difficulty = parseParkingJamRecordedDifficulty(value);

      expect(difficulty).toBe(expected);
    },
  );
});

describe("getParkingJamDifficultyLabel", () => {
  const cases = [
    ["1", "レベル 1"],
    ["5", "レベル 5"],
    ["easy", "かんたん"],
  ] as const;

  test.each(cases)(
    "レベルと旧3段階の表示名を返すこと: %s",
    (difficulty, expected) => {
      const label = getParkingJamDifficultyLabel(difficulty);

      expect(label).toBe(expected);
    },
  );
});

describe("calculateParkingJamDifficultyFactors", () => {
  const dependencyCases = [
    ["段数2で先行1台", { dependencyDepth: 2 }, 1],
    [
      "段数2で先行2台",
      { dependencyDepth: 2, maximumPrerequisiteVehicleCount: 2 },
      2,
    ],
    [
      "段数3の一本道",
      { dependencyDepth: 3, maximumPrerequisiteVehicleCount: 2 },
      2,
    ],
    [
      "段数3で枝分かれ2",
      { dependencyDepth: 3, maximumPrerequisiteVehicleCount: 4 },
      3,
    ],
    ["段数4", { dependencyDepth: 4, maximumPrerequisiteVehicleCount: 3 }, 3],
  ] as const;

  test.each(dependencyCases)(
    "依存の段数と先行台数から依存の強さを求めること: %s",
    (_label, features, expected) => {
      const factors = calculateParkingJamDifficultyFactors({
        ...baseFeatures,
        ...features,
      });

      expect(factors?.dependency).toBe(expected);
    },
  );

  const choiceConstraintCases = [
    ["両方が0.85以上", 0.85, 0.85, 1],
    ["合法車率だけが0.85未満", 0.84, 0.9, 2],
    ["解順自由度だけが0.85未満", 0.9, 0.84, 2],
    ["両方が中間", 0.8, 0.8, 2],
    ["合法車率だけが0.70未満", 0.69, 0.8, 2],
    ["解順自由度だけが0.70未満", 0.8, 0.69, 2],
    ["両方が0.70未満", 0.69, 0.69, 3],
  ] as const;

  test.each(choiceConstraintCases)(
    "合法車率と解順自由度から選択制約の強さを求めること: %s",
    (_label, averageLegalVehicleRatio, solutionOrderFreedom, expected) => {
      const factors = calculateParkingJamDifficultyFactors({
        ...baseFeatures,
        averageLegalVehicleRatio,
        solutionOrderFreedom,
      });

      expect(factors?.choiceConstraint).toBe(expected);
    },
  );

  const unsupportedCases = [
    { maximumPrerequisiteVehicleCount: null },
    { averageLegalVehicleRatio: null },
    { solutionOrderFreedom: null },
  ] as const;

  test.each(unsupportedCases)(
    "状態空間の必要な特徴を求められない問題では要因を返さないこと",
    (features) => {
      const factors = calculateParkingJamDifficultyFactors({
        ...baseFeatures,
        ...features,
      });

      expect(factors).toBeNull();
    },
  );
});

describe("assessParkingJamDifficulty", () => {
  const matrixCases = [
    ["1", 2, 1, 0.9, 0.9],
    ["2", 2, 1, 0.8, 0.8],
    ["3", 2, 1, 0.6, 0.6],
    ["2", 3, 2, 0.9, 0.9],
    ["3", 3, 2, 0.8, 0.8],
    ["4", 3, 2, 0.6, 0.6],
    ["3", 4, 3, 0.9, 0.9],
    ["4", 4, 3, 0.8, 0.8],
    ["5", 4, 3, 0.6, 0.6],
  ] as const;

  test.each(matrixCases)(
    "依存と選択制約を足し合わせた段階へ分類すること: レベル %s",
    (expected, dependencyDepth, maximumPrerequisiteVehicleCount, averageLegalVehicleRatio, solutionOrderFreedom) => {
      const assessment = assessParkingJamDifficulty(
        toAnalysis({
          dependencyDepth,
          maximumPrerequisiteVehicleCount,
          averageLegalVehicleRatio,
          solutionOrderFreedom,
        }),
      );

      expect(assessment).toMatchObject({
        status: "classified",
        difficulty: expected,
      });
    },
  );

  const outOfRangeCases = [
    ["全車がすぐ出せる", { dependencyDepth: 1 }, "too-light"],
    ["塞がれた車が1台だけ", { initialLegalVehicleCount: 7 }, "too-light"],
    [
      "段数7以上",
      { dependencyDepth: 7, maximumPrerequisiteVehicleCount: 6 },
      "too-heavy",
    ],
  ] as const;

  test.each(outOfRangeCases)(
    "提供範囲外の問題をレベルへ押し込まないこと: %s",
    (_label, features, reason) => {
      const assessment = assessParkingJamDifficulty(toAnalysis(features));

      expect(assessment).toMatchObject({ status: "out-of-range", reason });
    },
  );

  describe("状態空間を解析できない問題の場合", () => {
    const analysis: ParkingJamDifficultyAnalysis = {
      status: "unsupported",
      features: { ...baseFeatures, maximumPrerequisiteVehicleCount: null },
    };

    test("評価不能として提供しないこと", () => {
      const assessment = assessParkingJamDifficulty(analysis);

      expect(assessment).toEqual({ status: "unsupported" });
    });
  });

  describe("読み違いと盤面規模だけが違う場合", () => {
    const first = toAnalysis({
      misreadInducingVehicleCount: 0,
      boardCellCount: 36,
      vehicleCount: 8,
    });
    const second = toAnalysis({
      misreadInducingVehicleCount: 8,
      boardCellCount: 64,
      vehicleCount: 14,
      initialLegalVehicleCount: 11,
    });

    test("同じ判定になること", () => {
      const firstAssessment = assessParkingJamDifficulty(first);
      const secondAssessment = assessParkingJamDifficulty(second);

      expect(firstAssessment).toEqual(secondAssessment);
    });
  });

  describe("出せる車と解順の自由度がともに下がる場合", () => {
    const loose = toAnalysis({
      averageLegalVehicleRatio: 0.9,
      solutionOrderFreedom: 0.9,
    });
    const tight = toAnalysis({
      averageLegalVehicleRatio: 0.6,
      solutionOrderFreedom: 0.6,
    });

    test("選択制約が強い問題を2段高く分類すること", () => {
      const looseAssessment = assessParkingJamDifficulty(loose);
      const tightAssessment = assessParkingJamDifficulty(tight);

      expect(looseAssessment).toMatchObject({ difficulty: "1" });
      expect(tightAssessment).toMatchObject({ difficulty: "3" });
    });
  });
});
