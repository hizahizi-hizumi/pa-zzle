import { difficultyLevels } from "@/games/difficulty";
import {
  assessHitofudePuzzleDifficulty,
  type HitofudePuzzleDifficulty,
  type HitofudePuzzleLevelCombination,
  hitofudePuzzleLevelCombinations,
  listHitofudePuzzleGenerationConditions,
} from "@/games/hitofude-puzzle/difficulty";
import type { HitofudePuzzleDifficultyAnalysis } from "@/games/hitofude-puzzle/problem/difficulty-analysis";
import { measureHitofudePuzzleLookaheadLoad } from "@/games/hitofude-puzzle/problem/generation/human-solver";
import {
  hitofudePuzzleBoardSizes,
  hitofudePuzzleTargetLookaheadLoads,
} from "@/games/hitofude-puzzle/problem/problem";

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
}: AnalysisInput): HitofudePuzzleDifficultyAnalysis {
  return {
    status: "analyzed",
    scale: {
      size,
      cellCount: size * size,
      openCellCount: size * size,
      holeCount: 0,
    },
    reasoning: {
      localReasoningSuffices,
      regionalReasoningUsed: false,
      assumptionCount,
      deepAssumptionCount,
      longestRefutationLength,
      refutationLengths: [],
      lookaheadLoad: measureHitofudePuzzleLookaheadLoad(
        assumptionCount,
        longestRefutationLength,
      ),
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
    hitofudePuzzleLevelCombinations[lowerId] as HitofudePuzzleLevelCombination,
    hitofudePuzzleLevelCombinations[upperId] as HitofudePuzzleLevelCombination,
  ] as const;
});

describe("hitofudePuzzleLevelCombinations", () => {
  test("局所の推論だけで決まる問題をレベル1だけに置くこと", () => {
    const localOnly = difficultyIds.filter(
      (id) => hitofudePuzzleLevelCombinations[id].localReasoningSuffices,
    );

    expect(localOnly).toEqual(["1"]);
  });

  test.each(adjacentPairs)(
    "レベル %s で、上のレベルの先読みの重さと盤面サイズの範囲が両端とも下のレベルより小さくならないこと",
    (_, lower, upper) => {
      const lowerBounds = [
        lower.lookaheadLoad.minimum,
        lower.lookaheadLoad.maximum,
        lower.boardSize.minimum,
        lower.boardSize.maximum,
      ];
      const upperBounds = [
        upper.lookaheadLoad.minimum,
        upper.lookaheadLoad.maximum,
        upper.boardSize.minimum,
        upper.boardSize.maximum,
      ];

      const narrowed = upperBounds.filter(
        (bound, order) => bound < lowerBounds[order]!,
      );

      expect(narrowed).toEqual([]);
    },
  );

  test.each(adjacentPairs.slice(1))(
    "レベル %s で、先読みの重さの範囲が隙間なく続き、重ならないこと",
    (_, lower, upper) => {
      const gap = upper.lookaheadLoad.minimum - lower.lookaheadLoad.maximum;

      expect(gap).toBe(1);
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

describe("assessHitofudePuzzleDifficulty", () => {
  const classifiedCases: readonly (readonly [
    string,
    AnalysisInput,
    HitofudePuzzleDifficulty,
  ])[] = [
    [
      "5×5 で局所の推論だけで決まる",
      { size: 5, localReasoningSuffices: true },
      "1",
    ],
    ["6×6 で分断の推論で止まりを抜ける", { size: 6 }, "2"],
    [
      "7×7 で仮置き1局面・5手の先読み",
      { size: 7, assumptionCount: 1, longestRefutationLength: 5 },
      "2",
    ],
    [
      "7×7 で仮置き1局面・12手の先読み",
      { size: 7, assumptionCount: 1, longestRefutationLength: 12 },
      "3",
    ],
    [
      "8×8 で仮置き2局面・先読みがどれも8手以内",
      { size: 8, assumptionCount: 2, longestRefutationLength: 8 },
      "3",
    ],
    [
      "7×7 で仮置き2局面・10手の先読み",
      { size: 7, assumptionCount: 2, longestRefutationLength: 10 },
      "4",
    ],
    [
      "8×8 で仮置き3局面・先読みがどれも8手以内",
      { size: 8, assumptionCount: 3, longestRefutationLength: 8 },
      "4",
    ],
    [
      "8×8 で仮置き3局面・9手の先読み",
      { size: 8, assumptionCount: 3, longestRefutationLength: 9 },
      "5",
    ],
    [
      "8×8 で仮置き2局面・21手の先読み",
      { size: 8, assumptionCount: 2, longestRefutationLength: 21 },
      "5",
    ],
  ];

  test.each(classifiedCases)(
    "%s問題をレベル %s に分類すること",
    (_, input, expected) => {
      const assessment = assessHitofudePuzzleDifficulty(toAnalysis(input));

      expect(assessment).toMatchObject({
        status: "classified",
        difficulty: expected,
      });
    },
  );

  const unlistedCases: readonly (readonly [string, AnalysisInput])[] = [
    ["7×7 で局所の推論だけで決まる", { size: 7, localReasoningSuffices: true }],
    [
      "6×6 で仮置き2局面",
      { size: 6, assumptionCount: 2, longestRefutationLength: 5 },
    ],
    [
      "7×7 で仮置き3局面・9手の先読み",
      { size: 7, assumptionCount: 3, longestRefutationLength: 9 },
    ],
    [
      "8×8 で仮置き1局面・先読みが8手以内",
      { size: 8, assumptionCount: 1, longestRefutationLength: 5 },
    ],
  ];

  test.each(unlistedCases)(
    "%s問題を組み合わせ外として提供しないこと",
    (_, input) => {
      const assessment = assessHitofudePuzzleDifficulty(toAnalysis(input));

      expect(assessment).toMatchObject({
        status: "out-of-range",
        reason: "unlisted-combination",
      });
    },
  );

  describe("2段仮置きを要する問題の場合", () => {
    const analysis = toAnalysis({
      size: 8,
      assumptionCount: 3,
      longestRefutationLength: 20,
      deepAssumptionCount: 1,
    });

    test("重すぎるので提供しないこと", () => {
      const assessment = assessHitofudePuzzleDifficulty(analysis);

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
      const assessment = assessHitofudePuzzleDifficulty(analysis);

      expect(assessment).toEqual({
        status: "out-of-range",
        reason: "too-light",
      });
    });
  });

  const unassessableCases: readonly (readonly [
    string,
    HitofudePuzzleDifficultyAnalysis,
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
      const assessment = assessHitofudePuzzleDifficulty(analysis);

      expect(assessment).toEqual({ status: expected });
    },
  );
});

describe("listHitofudePuzzleGenerationConditions", () => {
  const expected = hitofudePuzzleBoardSizes
    .filter((size) => size <= 6)
    .flatMap((size) =>
      hitofudePuzzleTargetLookaheadLoads.map((targetLookaheadLoad) => ({
        size,
        targetLookaheadLoad,
      })),
    );

  test("レベルの盤面サイズの範囲の盤面を、すべての先読みの重さの目標で挙げること", () => {
    const conditions = listHitofudePuzzleGenerationConditions("1");

    expect(conditions).toEqual(expected);
  });
});
