import {
  assessTakuzuDifficulty,
  classifyTakuzuChallengeDifficulty,
  type TakuzuDifficulty,
} from "@/games/takuzu/difficulty";
import type {
  TakuzuDifficultyAnalysis,
  TakuzuHumanSolveFeatures,
} from "@/games/takuzu/problem/difficulty-analysis";
import type { TakuzuTechnique } from "@/games/takuzu/problem/generation/human-solver";

function createFeatures(
  roundCountByTechnique: Partial<Record<TakuzuTechnique, number>>,
  duplicateAvoidanceRoundCount = 0,
): TakuzuHumanSolveFeatures {
  const counts = {
    adjacency: 3,
    "count-completion": 0,
    "single-remaining": 0,
    "duplicate-avoidance": 0,
    "general-line": 0,
    ...roundCountByTechnique,
  };
  const roundCount = Object.values(counts).reduce(
    (sum, count) => sum + count,
    0,
  );
  return {
    deepestTechnique: "adjacency",
    roundCountByTechnique: counts,
    roundCount,
    lineReadingRoundCount: 0,
    duplicateAvoidanceRoundCount,
    longestLineReadingStreak: 0,
    meanSourceCount: 2,
    minimumSourceCount: 1,
    singleSourceRoundCount: 0,
    firstLineReadingEmptyCellRatio: null,
  };
}

const scale = { cellCount: 64, givenCount: 20, emptyCellCount: 44 };

describe("classifyTakuzuChallengeDifficulty", () => {
  const cases: readonly [string, TakuzuHumanSolveFeatures, TakuzuDifficulty][] =
    [
      ["隣接・挟みだけで解ける問題", createFeatures({}), "1"],
      ["個数の完成が要る問題", createFeatures({ "count-completion": 1 }), "2"],
      [
        "残り1個の読みが要る問題",
        createFeatures({ "count-completion": 2, "single-remaining": 3 }),
        "3",
      ],
      [
        "重複の回避が1つの局面で要る問題",
        createFeatures({ "single-remaining": 3, "duplicate-avoidance": 1 }, 1),
        "4",
      ],
      [
        "重複の回避が2つの局面で要る問題",
        createFeatures({ "duplicate-avoidance": 2 }, 2),
        "5",
      ],
      ["一般の行候補が要る問題", createFeatures({ "general-line": 1 }, 0), "5"],
    ];

  test.each(cases)("%s を難易度 %s に分類すること", (_, features, expected) => {
    const result = classifyTakuzuChallengeDifficulty(features);

    expect(result).toBe(expected);
  });
});

describe("assessTakuzuDifficulty", () => {
  const cases: readonly [
    string,
    TakuzuDifficultyAnalysis,
    ReturnType<typeof assessTakuzuDifficulty>,
  ][] = [
    [
      "3ラウンドで解き終わる問題を提供範囲外にすること",
      { status: "analyzed", scale, features: createFeatures({}) },
      { status: "out-of-range", reason: "too-light" },
    ],
    [
      "4ラウンド要る問題を提供範囲に入れること",
      {
        status: "analyzed",
        scale,
        features: createFeatures({ adjacency: 4 }),
      },
      { status: "classified", difficulty: "1" },
    ],
    [
      "評価不能の問題を難易度へ分類しないこと",
      { status: "unsupported", scale },
      { status: "unsupported" },
    ],
    [
      "成立しない問題を難易度へ分類しないこと",
      { status: "invalid", reason: "multiple-solutions", scale },
      { status: "invalid" },
    ],
  ];

  test.each(cases)("%s", (_, analysis, expected) => {
    const result = assessTakuzuDifficulty(analysis);

    expect(result).toEqual(expected);
  });
});
