import {
  assessNanpureDifficulty,
  classifyNanpureChallengeDifficulty,
  getNanpureDifficultyLabel,
  type NanpureDifficulty,
  parseNanpureDifficulty,
  parseNanpureRecordedDifficulty,
} from "@/games/nanpure/difficulty";
import type {
  NanpureDifficultyAnalysis,
  NanpureHumanSolveFeatures,
} from "@/games/nanpure/problem/difficulty-analysis";
import {
  isNanpurePlacementTechnique,
  type NanpureTechnique,
  nanpureTechniques,
} from "@/games/nanpure/problem/technique";

/** 手筋ごとのラウンド数から、つじつまの合う特徴量を作る。 */
function createFeatures(
  roundCountByTechnique: Partial<Record<NanpureTechnique, number>>,
): NanpureHumanSolveFeatures {
  const counts = Object.fromEntries(
    nanpureTechniques.map((technique) => [
      technique,
      roundCountByTechnique[technique] ?? 0,
    ]),
  ) as Record<NanpureTechnique, number>;
  const usedTechniques = nanpureTechniques.filter(
    (technique) => counts[technique] > 0,
  );
  const deepestTechnique = usedTechniques.at(-1) ?? null;
  const eliminationRoundCount = nanpureTechniques
    .filter((technique) => !isNanpurePlacementTechnique(technique))
    .reduce((sum, technique) => sum + counts[technique], 0);
  return {
    deepestTechnique,
    roundCountByTechnique: counts,
    roundCount: nanpureTechniques.reduce(
      (sum, technique) => sum + counts[technique],
      0,
    ),
    deepestTechniqueRoundCount: deepestTechnique ? counts[deepestTechnique] : 0,
    eliminationRoundCount,
    longestEliminationStreak: Math.min(eliminationRoundCount, 1),
    meanAvailablePlacementCount: 3,
    minimumAvailablePlacementCount: 1,
    singleAvailablePlacementRoundCount: 0,
    firstEliminationEmptyCellRatio: eliminationRoundCount > 0 ? 0.5 : null,
  };
}

const scale = { clueCount: 25, emptyCellCount: 56 };

describe("parseNanpureDifficulty", () => {
  const definedCases = ["1", "2", "3", "4", "5"] as const;
  const undefinedCases = [undefined, "", "0", "6", "easy"] as const;

  test.each(definedCases)("%s を難易度として受理すること", (input) => {
    const result = parseNanpureDifficulty(input);

    expect(result).toBe(input);
  });

  test.each(undefinedCases)("%s を難易度として拒否すること", (input) => {
    const result = parseNanpureDifficulty(input);

    expect(result).toBeUndefined();
  });
});

describe("parseNanpureRecordedDifficulty", () => {
  const cases = [
    ["3", "3"],
    ["hard", "hard"],
    ["expert", undefined],
  ] as const;

  test.each(cases)(
    "記録の難易度をレベルと旧3段階の両方で読むこと: %s",
    (value, expected) => {
      const result = parseNanpureRecordedDifficulty(value);

      expect(result).toBe(expected);
    },
  );
});

describe("getNanpureDifficultyLabel", () => {
  const cases = [
    ["3", "レベル 3"],
    ["normal", "ふつう"],
  ] as const;

  test.each(cases)(
    "レベルと旧3段階の表示名を返すこと: %s",
    (difficulty, expected) => {
      const result = getNanpureDifficultyLabel(difficulty);

      expect(result).toBe(expected);
    },
  );
});

describe("classifyNanpureChallengeDifficulty", () => {
  const cases: readonly [
    string,
    NanpureHumanSolveFeatures,
    NanpureDifficulty,
  ][] = [
    [
      "ブロックのシングルだけで解ける問題",
      createFeatures({ "full-house": 4, "hidden-single-block": 12 }),
      "1",
    ],
    [
      "行・列のシングルが要る問題",
      createFeatures({ "hidden-single-block": 10, "hidden-single-line": 2 }),
      "2",
    ],
    [
      "マスのシングルが要る問題",
      createFeatures({ "hidden-single-block": 10, "naked-single": 1 }),
      "2",
    ],
    [
      "ブロックと行・列の重なりが要る問題",
      createFeatures({ "naked-single": 3, "locked-candidates": 2 }),
      "3",
    ],
    [
      "数字の組が要る問題",
      createFeatures({ "locked-candidates": 4, "naked-pair": 1 }),
      "4",
    ],
    ["場所の3つ組が要る問題", createFeatures({ "hidden-triple": 1 }), "4"],
    ["X-Wing が要る問題", createFeatures({ "x-wing": 1 }), "5"],
    ["Swordfish が要る問題", createFeatures({ swordfish: 1 }), "5"],
    [
      "XY-Wing が要る問題",
      createFeatures({ "naked-pair": 3, "xy-wing": 1 }),
      "5",
    ],
    ["XYZ-Wing が要る問題", createFeatures({ "xyz-wing": 1 }), "5"],
  ];

  test.each(cases)("%s をレベル %s に分類すること", (_, features, expected) => {
    const result = classifyNanpureChallengeDifficulty(features);

    expect(result).toBe(expected);
  });
});

describe("assessNanpureDifficulty", () => {
  const cases: readonly [
    string,
    NanpureDifficultyAnalysis,
    ReturnType<typeof assessNanpureDifficulty>,
  ][] = [
    [
      "最後の1マスを埋めるだけで解き終わる問題を提供範囲外にすること",
      {
        status: "analyzed",
        scale,
        features: createFeatures({ "full-house": 3 }),
      },
      { status: "out-of-range", reason: "too-light" },
    ],
    [
      "ブロックのシングルが1つでも要る問題を提供範囲に入れること",
      {
        status: "analyzed",
        scale,
        features: createFeatures({ "full-house": 3, "hidden-single-block": 1 }),
      },
      { status: "classified", difficulty: "1" },
    ],
    [
      "評価不能の問題をレベル 5 にせず、難易度へ分類しないこと",
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
    const result = assessNanpureDifficulty(analysis);

    expect(result).toEqual(expected);
  });
});
