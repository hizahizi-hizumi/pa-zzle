import {
  assessTsumeShogiDifficulty,
  getTsumeShogiDifficultyLabel,
  listTsumeShogiGenerationConditions,
  parseTsumeShogiDifficulty,
  type TsumeShogiDifficulty,
  type TsumeShogiLevelCombination,
  tsumeShogiDifficulties,
  tsumeShogiLevelCombinations,
} from "@/games/tsume-shogi/difficulty";
import type {
  TsumeShogiDifficultyAnalysis,
  TsumeShogiDifficultyFeatures,
} from "@/games/tsume-shogi/problem/difficulty-analysis";

type FeatureValues = Pick<
  TsumeShogiDifficultyFeatures,
  | "rootChecks"
  | "plausibleWrong"
  | "deepDecoyCount"
  | "defenseBranching"
  | "tesujiKindCount"
>;

function toAnalysis(
  values: FeatureValues,
  plies = 5,
): TsumeShogiDifficultyAnalysis {
  return {
    status: "analyzed",
    plies,
    features: {
      ...values,
      decisions: [],
      motifs: {
        drop: 0,
        promotion: 0,
        nonPromotion: 0,
        capture: 0,
        sacrifice: 0,
        discoveredCheck: 0,
        distantCheck: 0,
      },
    },
  };
}

function features(
  rootChecks: number,
  plausibleWrong: number,
  deepDecoyCount: number,
  tesujiKindCount = 2,
  defenseBranching = 0,
): FeatureValues {
  return {
    rootChecks,
    plausibleWrong,
    deepDecoyCount,
    tesujiKindCount,
    defenseBranching,
  };
}

const combinationCases = tsumeShogiDifficulties.map(
  ({ id }): readonly [TsumeShogiDifficulty, TsumeShogiLevelCombination] => [
    id,
    tsumeShogiLevelCombinations[id],
  ],
);

const adjacentPairs = combinationCases
  .slice(1)
  .map(([upperId, upper], index) => {
    const [lowerId, lower] = combinationCases[index]!;
    return [`${lowerId}→${upperId}`, lower, upper] as const;
  });

describe("parseTsumeShogiDifficulty", () => {
  const cases = [
    ["1", "1"],
    ["5", "5"],
    ["6", undefined],
    [undefined, undefined],
  ] as const;

  test.each(cases)("%s を読むこと", (value, expected) => {
    const result = parseTsumeShogiDifficulty(value);

    expect(result).toBe(expected);
  });
});

describe("getTsumeShogiDifficultyLabel", () => {
  test("レベルの表示名を返すこと", () => {
    const result = getTsumeShogiDifficultyLabel("3");

    expect(result).toBe("レベル 3");
  });
});

describe("tsumeShogiLevelCombinations", () => {
  test.each(adjacentPairs)(
    "レベル %s で、深い紛れを求めるレベルの深い紛れの範囲が下のレベルと重ならないこと",
    (_, lower, upper) => {
      const overlaps =
        upper.deepDecoyCount.minimum > 0 &&
        upper.deepDecoyCount.minimum <= lower.deepDecoyCount.maximum;

      expect(overlaps).toBe(false);
    },
  );

  test.each(adjacentPairs)(
    "レベル %s で、もっともらしい誤王手の下限と生成条件の初手の王手の数の下限が下がらないこと",
    (_, lower, upper) => {
      const lowerBounds = [
        lower.plausibleWrong.minimum,
        lower.generationRootChecks.minimum,
      ];
      const upperBounds = [
        upper.plausibleWrong.minimum,
        upper.generationRootChecks.minimum,
      ];

      upperBounds.forEach((bound, index) => {
        expect(bound).toBeGreaterThanOrEqual(lowerBounds[index]!);
      });
    },
  );

  test.each(combinationCases)(
    "レベル %s で、もっともらしい誤王手の下限が深い紛れの下限より小さくないこと",
    (_, combination) => {
      const { plausibleWrong, deepDecoyCount } = combination;

      expect(plausibleWrong.minimum).toBeGreaterThanOrEqual(
        deepDecoyCount.minimum,
      );
    },
  );
});

describe("assessTsumeShogiDifficulty", () => {
  describe("分類できる組み合わせ", () => {
    const cases = [
      ["誤王手がどれもすぐ崩れる、候補の少ない問題", features(3, 0, 0, 0), "1"],
      ["誤王手がどれもすぐ崩れる、候補の多い問題", features(8, 0, 0, 0), "2"],
      ["浅い紛れのある問題", features(5, 3, 0, 1), "2"],
      ["深い紛れが1本の問題", features(5, 2, 1, 0), "3"],
      ["深い紛れが3本で手筋を組み合わせる問題", features(7, 5, 3, 2), "4"],
      ["深い紛れが3本で変化の多い問題", features(7, 5, 3, 1, 2), "4"],
      ["深い紛れが6本で手筋を組み合わせる問題", features(12, 9, 6, 2), "5"],
    ] as const;

    test.each(cases)("%sを分類すること", (_, values, expected) => {
      const result = assessTsumeShogiDifficulty(toAnalysis(values));

      expect(result).toEqual({
        status: "classified",
        difficulty: expected,
        deepDecoyCount: values.deepDecoyCount,
      });
    });
  });

  describe("どのレベルにも当たらない組み合わせ", () => {
    const cases = [
      ["深い紛れが無く、浅い紛れが多い問題", features(12, 8, 0)],
      ["深い紛れが無く、候補の多すぎる問題", features(14, 2, 0)],
      [
        "深い紛れが3本でも、手筋の組み合わせも変化も無い問題",
        features(7, 5, 3, 1, 1),
      ],
    ] as const;

    test.each(cases)("%sを提供範囲外にすること", (_, values) => {
      const result = assessTsumeShogiDifficulty(toAnalysis(values));

      expect(result).toEqual({
        status: "out-of-range",
        reason: "unlisted-combination",
      });
    });
  });

  describe("1手詰", () => {
    const analysis = toAnalysis(features(1, 0, 0, 0), 1);

    test("通常の難易度の手数として扱わず、提供範囲外にすること", () => {
      const result = assessTsumeShogiDifficulty(analysis);

      expect(result).toEqual({ status: "out-of-range", reason: "mate-in-one" });
    });
  });

  describe("評価できない問題", () => {
    const cases = [
      [
        {
          status: "unsupported",
          reason: "supported-subset",
          plies: 3,
          issues: [],
        },
        { status: "unsupported" },
      ],
      [
        { status: "invalid", reason: "quality", plies: 3, issues: ["noMate"] },
        { status: "invalid" },
      ],
    ] as const satisfies readonly (readonly [
      TsumeShogiDifficultyAnalysis,
      unknown,
    ])[];

    test.each(cases)("%o をそのままの状態で返すこと", (analysis, expected) => {
      const result = assessTsumeShogiDifficulty(analysis);

      expect(result).toEqual(expected);
    });
  });
});

describe("listTsumeShogiGenerationConditions", () => {
  test("深い紛れを求めないレベルは3手と5手の生成条件を、起点の玉を盤の中ほどに置く条件と合わせて挙げること", () => {
    const result = listTsumeShogiGenerationConditions("2");

    expect(result).toEqual([
      { plies: 3, rootChecks: { minimum: 2, maximum: 10 } },
      { plies: 5, rootChecks: { minimum: 2, maximum: 10 } },
      {
        plies: 3,
        rootChecks: { minimum: 2, maximum: 10 },
        baseKingArea: "middle",
      },
      {
        plies: 5,
        rootChecks: { minimum: 2, maximum: 10 },
        baseKingArea: "middle",
      },
    ]);
  });

  test("レベル1 は盤上の駒を動かす1手詰を起点にした3手の生成条件を足すこと", () => {
    const result = listTsumeShogiGenerationConditions("1");

    expect(result).toEqual([
      { plies: 3, rootChecks: { minimum: 1, maximum: 4 } },
      { plies: 5, rootChecks: { minimum: 1, maximum: 4 } },
      {
        plies: 3,
        rootChecks: { minimum: 1, maximum: 4 },
        baseMate: "board-move",
      },
      {
        plies: 3,
        rootChecks: { minimum: 1, maximum: 4 },
        baseKingArea: "middle",
      },
      {
        plies: 5,
        rootChecks: { minimum: 1, maximum: 4 },
        baseKingArea: "middle",
      },
      {
        plies: 3,
        rootChecks: { minimum: 1, maximum: 4 },
        baseMate: "board-move",
        baseKingArea: "middle",
      },
    ]);
  });

  test("深い紛れを求めるレベルは5手の生成条件だけを挙げること", () => {
    const result = listTsumeShogiGenerationConditions("3");
    const rootChecks = tsumeShogiLevelCombinations["3"].generationRootChecks;

    expect(result).toEqual([
      { plies: 5, rootChecks: { ...rootChecks } },
      { plies: 5, rootChecks: { ...rootChecks }, baseKingArea: "middle" },
    ]);
  });
});
