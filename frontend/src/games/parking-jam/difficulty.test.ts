import { difficultyLevels } from "@/games/difficulty";
import {
  assessParkingJamDifficulty,
  calculateParkingJamChallengeLevers,
  type ParkingJamDifficulty,
  parkingJamLevelLevers,
} from "@/games/parking-jam/difficulty";
import type {
  ParkingJamDifficultyAnalysis,
  ParkingJamDifficultyFeatures,
} from "@/games/parking-jam/problem/difficulty-analysis";

// 8×8・8台・固定物なしで、段数2・重なりなし・読み違いを誘う車なし（全レバー1）。
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
  return { status: "analyzed", features: { ...baseFeatures, ...features } };
}

describe("calculateParkingJamChallengeLevers", () => {
  const dependencyCases = [
    ["段数2で重なりなし", { dependencyDepth: 2 }, 1],
    [
      "段数2で2台以上を先に出す車がある",
      { dependencyDepth: 2, maximumPrerequisiteVehicleCount: 2 },
      2,
    ],
    [
      "段数3の一本道",
      { dependencyDepth: 3, maximumPrerequisiteVehicleCount: 2 },
      2,
    ],
    [
      "段数3で枝分かれ1",
      { dependencyDepth: 3, maximumPrerequisiteVehicleCount: 3 },
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
    "依存の段数と重なりから依存レバーを決めること: %s",
    (_label, features, expected) => {
      const levers = calculateParkingJamChallengeLevers({
        ...baseFeatures,
        ...features,
      });

      expect(levers?.dependency).toBe(expected);
    },
  );

  const misreadCases = [
    ["8台中1台", 1, 1],
    ["8台中2台（4台に1台）", 2, 2],
    ["8台中3台", 3, 2],
    ["8台中4台（2台に1台）", 4, 3],
  ] as const;

  test.each(misreadCases)(
    "読み違いを誘う車の割合から読み違いレバーを決めること: %s",
    (_label, misreadInducingVehicleCount, expected) => {
      const levers = calculateParkingJamChallengeLevers({
        ...baseFeatures,
        misreadInducingVehicleCount,
      });

      expect(levers?.misread).toBe(expected);
    },
  );

  const scaleCases = [
    ["6×6・14台（狭いが多い）", { boardCellCount: 36, vehicleCount: 14 }, 1],
    ["8×8・8台（広いが少ない）", { boardCellCount: 64, vehicleCount: 8 }, 1],
    ["6×8・11台", { boardCellCount: 48, vehicleCount: 11 }, 2],
    [
      "8×8・11台と固定物1",
      { boardCellCount: 64, vehicleCount: 11, fixedAreaCount: 1 },
      3,
    ],
  ] as const;

  test.each(scaleCases)(
    "盤面の広さと読む対象の数の弱い方で規模レバーを決めること: %s",
    (_label, features, expected) => {
      const levers = calculateParkingJamChallengeLevers({
        ...baseFeatures,
        ...features,
      });

      expect(levers?.scale).toBe(expected);
    },
  );

  describe("状態空間を解析できない問題の場合", () => {
    const features = {
      ...baseFeatures,
      maximumPrerequisiteVehicleCount: null,
    };

    test("レバーを求めないこと", () => {
      const levers = calculateParkingJamChallengeLevers(features);

      expect(levers).toBeNull();
    });
  });
});

describe("parkingJamLevelLevers", () => {
  const adjacentLevels = difficultyLevels
    .slice(1)
    .map(({ id }, index) => [
      difficultyLevels[index]?.id as ParkingJamDifficulty,
      id,
    ]);

  test.each(adjacentLevels)(
    "レベル %s よりレベル %s でどのレバーも弱まらず依存か読み違いの一方だけが強まること",
    (lower, higher) => {
      const lowerLevers = parkingJamLevelLevers[lower];
      const higherLevers = parkingJamLevelLevers[higher];

      const increases = [
        higherLevers.dependency - lowerLevers.dependency,
        higherLevers.misread - lowerLevers.misread,
      ];

      expect(increases.every((increase) => increase >= 0)).toBe(true);
      expect(increases.filter((increase) => increase > 0)).toHaveLength(1);
      expect(higherLevers.scale.minimum).toBeGreaterThanOrEqual(
        lowerLevers.scale.minimum,
      );
      expect(higherLevers.scale.maximum).toBeGreaterThanOrEqual(
        lowerLevers.scale.maximum,
      );
    },
  );

  test("規模レバー2の問題がどのレベルにも入れること", () => {
    const levelsAcceptingScale2 = difficultyLevels.filter(
      ({ id }) =>
        parkingJamLevelLevers[id].scale.minimum <= 2 &&
        parkingJamLevelLevers[id].scale.maximum >= 2,
    );

    expect(levelsAcceptingScale2).toHaveLength(5);
  });
});

describe("assessParkingJamDifficulty", () => {
  const classifiedCases = [
    ["1", {}],
    ["2", { misreadInducingVehicleCount: 2 }],
    [
      "3",
      {
        dependencyDepth: 3,
        maximumPrerequisiteVehicleCount: 2,
        misreadInducingVehicleCount: 2,
      },
    ],
    [
      "4",
      {
        dependencyDepth: 3,
        maximumPrerequisiteVehicleCount: 2,
        misreadInducingVehicleCount: 6,
        boardCellCount: 48,
        vehicleCount: 11,
        initialLegalVehicleCount: 7,
      },
    ],
    [
      "5",
      {
        dependencyDepth: 4,
        maximumPrerequisiteVehicleCount: 5,
        misreadInducingVehicleCount: 6,
        vehicleCount: 11,
        initialLegalVehicleCount: 7,
      },
    ],
  ] as const;

  test.each(classifiedCases)(
    "レバーの組合せがちょうど当たるレベルへ分類すること: レベル %s",
    (expected, features) => {
      const assessment = assessParkingJamDifficulty(toAnalysis(features));

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
    [
      "深い依存で読み違いを誘う車がない",
      { dependencyDepth: 4, maximumPrerequisiteVehicleCount: 5 },
      "unlisted-combination",
    ],
    [
      "浅い依存で読み違いを誘う車が半分以上",
      { misreadInducingVehicleCount: 4 },
      "unlisted-combination",
    ],
    [
      "レベル5のレバーで規模が小さい",
      {
        dependencyDepth: 4,
        maximumPrerequisiteVehicleCount: 5,
        misreadInducingVehicleCount: 4,
      },
      "unlisted-combination",
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

  describe("判定に使わない状態空間特徴だけが違う場合", () => {
    const first = toAnalysis({
      maximumVehicleBlockingInDegree: 1,
      maximumForcedChoiceChainLength: 1,
      averageLegalVehicleRatio: 0.9,
    });
    const second = toAnalysis({
      maximumVehicleBlockingInDegree: 6,
      maximumForcedChoiceChainLength: 10,
      averageLegalVehicleRatio: 0.4,
    });

    test("同じ判定になること", () => {
      const firstAssessment = assessParkingJamDifficulty(first);
      const secondAssessment = assessParkingJamDifficulty(second);

      expect(firstAssessment).toEqual(secondAssessment);
    });
  });
});
