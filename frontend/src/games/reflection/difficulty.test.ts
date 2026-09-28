import {
  assessReflectionDifficulty,
  getReflectionDifficultyLabel,
  listReflectionGenerationConditions,
  parseReflectionDifficulty,
  type ReflectionDifficulty,
  type ReflectionLevelCombination,
  reflectionDifficulties,
  reflectionLevelCombinations,
} from "@/games/reflection/difficulty";
import type {
  ReflectionDifficultyAnalysis,
  ReflectionReasoningFeatures,
  ReflectionScaleMetrics,
  ReflectionTrialFeatures,
} from "@/games/reflection/problem/difficulty-analysis";

/** 試し置きで解き切れない問題。どのレベルの試し置きの条件も満たす。 */
const trialUnsolved: ReflectionTrialFeatures = {
  solved: false,
  moveCount: 240,
  retryCount: 180,
};

function toAnalysis(
  highestLevel: ReflectionReasoningFeatures["highestLevel"],
  size: number,
  pieceCount: number,
  trial: ReflectionTrialFeatures = trialUnsolved,
): ReflectionDifficultyAnalysis {
  return {
    status: "analyzed",
    scale: {
      size,
      cellCount: size * size,
      clueCount: size * 4,
      pieceCount,
      pieceKindCount: 1,
    },
    features: {
      highestLevel,
      fixedPieceCountByLevel: [pieceCount, 0, 0, 0, 0],
      propagationRoundCount: 0,
      assumptionTestCount: 0,
      assumptionEliminationCount: 0,
    },
    trial,
  };
}

const difficultyIds = reflectionDifficulties.map(({ id }) => id);

const combinationCases = difficultyIds.map(
  (difficulty): readonly [ReflectionDifficulty, ReflectionLevelCombination] => [
    difficulty,
    reflectionLevelCombinations[difficulty],
  ],
);

describe("reflectionLevelCombinations", () => {
  const reasoningLevels = combinationCases.map(
    ([, combination]) => combination.reasoningLevel,
  );
  const adjacentPairs = combinationCases
    .slice(1)
    .map(([upperId, upper], index) => {
      const [lowerId, lower] = combinationCases[index]!;
      return [`${lowerId}→${upperId}`, lower, upper] as const;
    });

  test("推論レベルを1段ずつ上げること", () => {
    expect(reasoningLevels).toEqual([1, 2, 3, 4, 5]);
  });

  test.each(adjacentPairs)(
    "レベル %s で、上のレベルの規模の範囲が両端とも下のレベルより小さくならないこと",
    (_, lower, upper) => {
      const lowerBounds = [
        lower.boardSize.minimum,
        lower.boardSize.maximum,
        lower.pieceCount.minimum,
        lower.pieceCount.maximum,
      ];
      const upperBounds = [
        upper.boardSize.minimum,
        upper.boardSize.maximum,
        upper.pieceCount.minimum,
        upper.pieceCount.maximum,
      ];

      const narrowed = upperBounds.filter(
        (bound, order) => bound < lowerBounds[order]!,
      );

      expect(narrowed).toEqual([]);
    },
  );

  test.each(adjacentPairs)(
    "レベル %s で、上のレベルの試し置きのやり直しの下限が下のレベルより小さくならないこと",
    (_, lower, upper) => {
      expect(upper.minimumTrialRetryCount ?? 0).toBeGreaterThanOrEqual(
        lower.minimumTrialRetryCount ?? 0,
      );
    },
  );

  test("レベル5 は、試し置きで押し切れない問題に限ること", () => {
    expect(
      reflectionLevelCombinations["5"].minimumTrialRetryCount,
    ).toBeGreaterThan(0);
  });

  test.each(adjacentPairs)(
    "レベル %s が同じ盤面サイズ・ピース数を共有し、規模だけでレベルが決まらないこと",
    (_, lower, upper) => {
      const sharedMaximumSize = Math.min(
        lower.boardSize.maximum,
        upper.boardSize.maximum,
      );
      const sharedMaximumPieceCount = Math.min(
        lower.pieceCount.maximum,
        upper.pieceCount.maximum,
      );

      expect(sharedMaximumSize).toBeGreaterThanOrEqual(upper.boardSize.minimum);
      expect(sharedMaximumPieceCount).toBeGreaterThanOrEqual(
        upper.pieceCount.minimum,
      );
    },
  );
});

describe("assessReflectionDifficulty", () => {
  describe("組み合わせの規模の両端に当たる問題", () => {
    const cases = combinationCases.flatMap(
      ([difficulty, { reasoningLevel, boardSize, pieceCount }]) => [
        [
          difficulty,
          "最小",
          toAnalysis(reasoningLevel, boardSize.minimum, pieceCount.minimum),
          reasoningLevel,
        ] as const,
        [
          difficulty,
          "最大",
          toAnalysis(reasoningLevel, boardSize.maximum, pieceCount.maximum),
          reasoningLevel,
        ] as const,
      ],
    );

    test.each(cases)(
      "レベル %s の%sの規模の問題をそのレベルに分類すること",
      (difficulty, _, analysis, reasoningLevel) => {
        const result = assessReflectionDifficulty(analysis);

        expect(result).toEqual({
          status: "classified",
          difficulty,
          reasoningLevel,
        });
      },
    );
  });

  describe("推論レベルは合うがピース数が範囲より多い問題", () => {
    const cases = combinationCases.map(
      ([difficulty, { reasoningLevel, boardSize, pieceCount }]) =>
        [
          difficulty,
          toAnalysis(reasoningLevel, boardSize.maximum, pieceCount.maximum + 1),
          reasoningLevel,
        ] as const,
    );

    test.each(cases)(
      "レベル %s の推論レベルでも提供範囲外とすること",
      (_, analysis, reasoningLevel) => {
        const result = assessReflectionDifficulty(analysis);

        expect(result).toEqual({
          status: "out-of-range",
          reason: "unlisted-combination",
          reasoningLevel,
        });
      },
    );
  });

  describe("推論と規模はレベル5の範囲で、試し置きで押し切れる問題", () => {
    const { reasoningLevel, boardSize, pieceCount, minimumTrialRetryCount } =
      reflectionLevelCombinations["5"];
    const cases = [
      ["やり直しが下限より1回少なく解き切れる", minimumTrialRetryCount - 1],
      ["やり直しなしで解き切れる", 0],
    ] as const;

    test.each(cases)("%s問題を提供範囲外とすること", (_, retryCount) => {
      const result = assessReflectionDifficulty(
        toAnalysis(reasoningLevel, boardSize.maximum, pieceCount.maximum, {
          solved: true,
          moveCount: pieceCount.maximum + retryCount,
          retryCount,
        }),
      );

      expect(result).toEqual({
        status: "out-of-range",
        reason: "unlisted-combination",
        reasoningLevel,
      });
    });

    test("やり直しが下限ちょうどで解き切れる問題をレベル5に分類すること", () => {
      const result = assessReflectionDifficulty(
        toAnalysis(reasoningLevel, boardSize.maximum, pieceCount.maximum, {
          solved: true,
          moveCount: pieceCount.maximum + minimumTrialRetryCount,
          retryCount: minimumTrialRetryCount,
        }),
      );

      expect(result).toMatchObject({ status: "classified", difficulty: "5" });
    });
  });

  describe("規模はレベル5の範囲だが推論が浅い問題", () => {
    const { boardSize, pieceCount } = reflectionLevelCombinations["5"];
    const analysis = toAnalysis(3, boardSize.maximum, pieceCount.maximum);

    test("上位レベルに分類せず提供範囲外とすること", () => {
      const result = assessReflectionDifficulty(analysis);

      expect(result).toMatchObject({ status: "out-of-range" });
    });
  });

  describe("評価できない問題・成立しない問題", () => {
    const scale: ReflectionScaleMetrics = {
      size: 5,
      cellCount: 25,
      clueCount: 20,
      pieceCount: 3,
      pieceKindCount: 2,
    };
    const cases = [
      [
        "評価不能な問題を unsupported",
        {
          status: "unsupported",
          reason: "unresolved",
          scale,
          unresolvedCellCount: 4,
        },
        { status: "unsupported" },
      ],
      [
        "成立しない問題を invalid",
        { status: "invalid", reason: "multiple-solutions", scale },
        { status: "invalid" },
      ],
    ] as const;

    test.each(cases)("%s とすること", (_, analysis, expected) => {
      const result = assessReflectionDifficulty(analysis);

      expect(result).toEqual(expected);
    });
  });
});

describe("listReflectionGenerationConditions", () => {
  const cases = combinationCases.map(
    ([difficulty, { boardSize, pieceCount }]) =>
      [
        difficulty,
        (boardSize.maximum - boardSize.minimum + 1) *
          (pieceCount.maximum - pieceCount.minimum + 1),
        { size: boardSize.minimum, pieceCount: pieceCount.minimum },
        { size: boardSize.maximum, pieceCount: pieceCount.maximum },
      ] as const,
  );

  test.each(cases)(
    "レベル %s の規模の範囲に入る盤面サイズとピース数の組をすべて挙げること",
    (difficulty, expectedCount, smallest, largest) => {
      const conditions = listReflectionGenerationConditions(difficulty);

      expect(conditions).toHaveLength(expectedCount);
      expect(conditions).toContainEqual(smallest);
      expect(conditions).toContainEqual(largest);
    },
  );
});

describe("parseReflectionDifficulty", () => {
  const cases = [
    ["3", "3"],
    ["6", undefined],
    [undefined, undefined],
  ] as const;

  test.each(cases)("%s を難易度として読むこと", (value, expected) => {
    const result = parseReflectionDifficulty(value);

    expect(result).toBe(expected);
  });
});

describe("getReflectionDifficultyLabel", () => {
  test("難易度のラベルを返すこと", () => {
    const result = getReflectionDifficultyLabel("5");

    expect(result).toBe("レベル 5");
  });
});
