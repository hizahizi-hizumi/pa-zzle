import { difficultyLevels } from "@/games/difficulty";
import {
  assessHamiltonianPathDifficulty,
  type HamiltonianPathDifficulty,
  type HamiltonianPathLevelCombination,
  hamiltonianPathLevelCombinations,
  listHamiltonianPathGenerationConditions,
} from "@/games/hamiltonian-path/difficulty";
import type { HamiltonianPathDifficultyAnalysis } from "@/games/hamiltonian-path/problem/difficulty-analysis";

type AnalysisInput = {
  size: number;
  localReasoningSuffices?: boolean;
  assumptionCount?: number;
  longestRefutationLength?: number;
  deepAssumptionCount?: number;
  fatalBranchCount?: number;
};

function toAnalysis({
  size,
  localReasoningSuffices = false,
  assumptionCount = 0,
  longestRefutationLength = 0,
  deepAssumptionCount = 0,
  fatalBranchCount = 3,
}: AnalysisInput): HamiltonianPathDifficultyAnalysis {
  return {
    status: "analyzed",
    scale: {
      size,
      cellCount: size * size,
      openCellCount: size * size,
      wallCount: 0,
      partitionCount: 10,
    },
    reasoning: {
      localReasoningSuffices,
      regionalReasoningUsed: false,
      assumptionCount,
      deepAssumptionCount,
      longestRefutationLength,
      refutationLengths: [],
      stallCount: localReasoningSuffices ? 0 : assumptionCount + 1,
      firstStallDecidedEdgeRatio: localReasoningSuffices ? 1 : 0.5,
      firingCountByStage: { 1: 40, 2: 5, 3: 0, 4: 0, 5: assumptionCount, 6: 0 },
    },
    drawing: {
      branchCount: fatalBranchCount,
      fatalBranchCount,
      fatalBranchCountByStage: { 2: fatalBranchCount, 3: 0, 4: 0, 5: 0, 6: 0 },
      longestTrapLength: 10,
    },
  };
}

const difficultyIds = difficultyLevels.map(({ id }) => id);

const adjacentPairs = difficultyIds.slice(1).map((upperId, index) => {
  const lowerId = difficultyIds[index]!;
  return [
    `${lowerId}→${upperId}`,
    hamiltonianPathLevelCombinations[
      lowerId
    ] as HamiltonianPathLevelCombination,
    hamiltonianPathLevelCombinations[
      upperId
    ] as HamiltonianPathLevelCombination,
  ] as const;
});

describe("hamiltonianPathLevelCombinations", () => {
  test("局所の推論だけで決まる問題をレベル1だけに置くこと", () => {
    const localOnly = difficultyIds.filter(
      (id) => hamiltonianPathLevelCombinations[id].localReasoningSuffices,
    );

    expect(localOnly).toEqual(["1"]);
  });

  test.each(adjacentPairs)(
    "レベル %s で、上のレベルの仮置きの回数と盤面サイズの範囲が両端とも下のレベルより小さくならないこと",
    (_, lower, upper) => {
      const lowerBounds = [
        lower.assumptionCount.minimum,
        lower.assumptionCount.maximum,
        lower.boardSize.minimum,
        lower.boardSize.maximum,
        lower.minimumLongestRefutationLength ?? 0,
      ];
      const upperBounds = [
        upper.assumptionCount.minimum,
        upper.assumptionCount.maximum,
        upper.boardSize.minimum,
        upper.boardSize.maximum,
        upper.minimumLongestRefutationLength ?? 0,
      ];

      const narrowed = upperBounds.filter(
        (bound, order) => bound < lowerBounds[order]!,
      );

      expect(narrowed).toEqual([]);
    },
  );

  test.each(adjacentPairs)(
    "レベル %s が同じ盤面サイズを共有し、盤面サイズだけでレベルが決まらないこと",
    (_, lower, upper) => {
      const sharedMinimum = Math.max(
        lower.boardSize.minimum,
        upper.boardSize.minimum,
      );
      const sharedMaximum = Math.min(
        lower.boardSize.maximum,
        upper.boardSize.maximum,
      );

      expect(sharedMinimum).toBeLessThanOrEqual(sharedMaximum);
    },
  );
});

describe("assessHamiltonianPathDifficulty", () => {
  const classifiedCases: readonly (readonly [
    string,
    AnalysisInput,
    HamiltonianPathDifficulty,
  ])[] = [
    [
      "5×5 で局所の推論だけで決まる",
      { size: 5, localReasoningSuffices: true },
      "1",
    ],
    ["6×6 で分断の推論で止まりを抜ける", { size: 6 }, "2"],
    ["7×7 で仮置き1回", { size: 7, assumptionCount: 1 }, "2"],
    ["7×7 で仮置き2回", { size: 7, assumptionCount: 2 }, "3"],
    ["8×8 で仮置き3回", { size: 8, assumptionCount: 3 }, "3"],
    ["7×7 で仮置き6回", { size: 7, assumptionCount: 6 }, "4"],
    [
      "8×8 で仮置き7回・9手の先読み",
      { size: 8, assumptionCount: 7, longestRefutationLength: 9 },
      "5",
    ],
  ];

  test.each(classifiedCases)(
    "%s問題をレベル %s に分類すること",
    (_, input, expected) => {
      const assessment = assessHamiltonianPathDifficulty(toAnalysis(input));

      expect(assessment).toMatchObject({
        status: "classified",
        difficulty: expected,
      });
    },
  );

  const unlistedCases: readonly (readonly [string, AnalysisInput])[] = [
    ["7×7 で局所の推論だけで決まる", { size: 7, localReasoningSuffices: true }],
    ["6×6 で仮置き2回", { size: 6, assumptionCount: 2 }],
    ["7×7 で仮置き7回", { size: 7, assumptionCount: 7 }],
    [
      "8×8 で仮置き7回だが先読みがどれも8手以内",
      { size: 8, assumptionCount: 7, longestRefutationLength: 8 },
    ],
  ];

  test.each(unlistedCases)(
    "%s問題を組み合わせ外として提供しないこと",
    (_, input) => {
      const assessment = assessHamiltonianPathDifficulty(toAnalysis(input));

      expect(assessment).toMatchObject({
        status: "out-of-range",
        reason: "unlisted-combination",
      });
    },
  );

  describe("2段仮置きを要する問題の場合", () => {
    const analysis = toAnalysis({
      size: 8,
      assumptionCount: 8,
      longestRefutationLength: 20,
      deepAssumptionCount: 1,
    });

    test("重すぎるので提供しないこと", () => {
      const assessment = assessHamiltonianPathDifficulty(analysis);

      expect(assessment).toEqual({
        status: "out-of-range",
        reason: "too-heavy",
      });
    });
  });

  describe("始点から引き進めると迷う分岐が無い問題の場合", () => {
    const analysis = toAnalysis({
      size: 5,
      localReasoningSuffices: true,
      fatalBranchCount: 0,
    });

    test("軽すぎるので提供しないこと", () => {
      const assessment = assessHamiltonianPathDifficulty(analysis);

      expect(assessment).toEqual({
        status: "out-of-range",
        reason: "too-light",
      });
    });
  });

  const unassessableCases: readonly (readonly [
    string,
    HamiltonianPathDifficultyAnalysis,
  ])[] = [
    [
      "unsupported",
      {
        status: "unsupported",
        reason: "unresolved",
        scale: toAnalysis({ size: 8 }).scale,
      },
    ],
    [
      "invalid",
      {
        status: "invalid",
        reason: "multiple-solutions",
        scale: toAnalysis({ size: 8 }).scale,
      },
    ],
  ];

  test.each(unassessableCases)(
    "評価できない分析結果を状態 %s のまま返すこと",
    (expected, analysis) => {
      const assessment = assessHamiltonianPathDifficulty(analysis);

      expect(assessment).toEqual({ status: expected });
    },
  );
});

describe("listHamiltonianPathGenerationConditions", () => {
  test("レベルの盤面サイズの範囲の盤面を、すべての壁率で挙げること", () => {
    const conditions = listHamiltonianPathGenerationConditions("1");

    expect(conditions).toEqual([
      { size: 5, wallRatio: 0 },
      { size: 5, wallRatio: 0.15 },
      { size: 6, wallRatio: 0 },
      { size: 6, wallRatio: 0.15 },
    ]);
  });
});
