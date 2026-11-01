import { difficultyLevels } from "@/games/difficulty";
import {
  assessNonogramDifficulty,
  type NonogramDifficulty,
  type NonogramLevelCombination,
  nonogramLevelCombinations,
} from "@/games/nonogram/difficulty";
import type {
  NonogramDifficultyAnalysis,
  NonogramReadingFeatures,
} from "@/games/nonogram/problem/difficulty-analysis";
import type { NonogramGridSize } from "@/games/nonogram/puzzle/board";

function toAnalysis(
  { width, height }: NonogramGridSize,
  features: Pick<
    NonogramReadingFeatures,
    "roundCount" | "entryLineCount" | "narrowRoundCount"
  >,
): NonogramDifficultyAnalysis {
  return {
    status: "analyzed",
    scale: { width, height, cellCount: width * height },
    features: {
      firstRoundFixedCellCount: 10,
      minimumProgressedLineCount: 1,
      readingsBeyondEdgesCount: 0,
      ...features,
    },
  };
}

function getArea({ width, height }: NonogramGridSize): number {
  return width * height;
}

const combinationCases = difficultyLevels.map(
  ({ id }) =>
    [id, nonogramLevelCombinations[id]] as const satisfies readonly [
      NonogramDifficulty,
      NonogramLevelCombination,
    ],
);

const adjacentPairs = combinationCases
  .slice(1)
  .map(([upperId, upper], index) => {
    const [lowerId, lower] = combinationCases[index]!;
    return [`${lowerId}→${upperId}`, lower, upper] as const;
  });

describe("nonogramLevelCombinations", () => {
  test.each(adjacentPairs)(
    "レベル %s で、上のレベルの連鎖の深さの範囲が下のレベルより深く、重ならないこと",
    (_, lower, upper) => {
      const gap = upper.roundCount.minimum - lower.roundCount.maximum;

      expect(gap).toBeGreaterThan(0);
    },
  );

  test.each(adjacentPairs)(
    "レベル %s で、上のレベルが盤面の面積・細い段の数の下限を下げず、入口の広さの上限を上げないこと",
    (_, lower, upper) => {
      const lowerAreas = lower.boardSizes.map(getArea);
      const upperAreas = upper.boardSizes.map(getArea);
      const loosened = {
        smallestArea: Math.min(...upperAreas) < Math.min(...lowerAreas),
        largestArea: Math.max(...upperAreas) < Math.max(...lowerAreas),
        entryLineCount:
          upper.entryLineCount.maximum > lower.entryLineCount.maximum,
        narrowRoundCount:
          upper.narrowRoundCount.minimum < lower.narrowRoundCount.minimum,
      };

      expect(loosened).toEqual({
        smallestArea: false,
        largestArea: false,
        entryLineCount: false,
        narrowRoundCount: false,
      });
    },
  );

  test.each(adjacentPairs)(
    "レベル %s が盤面の大きさを1つ以上共有し、大きさだけでレベルが決まらないこと",
    (_, lower, upper) => {
      const sharedSizes = upper.boardSizes.filter((size) =>
        lower.boardSizes.some(
          ({ width, height }) => width === size.width && height === size.height,
        ),
      );

      expect(sharedSizes.length).toBeGreaterThan(0);
    },
  );
});

describe("assessNonogramDifficulty", () => {
  describe("組み合わせの両端に当たる問題", () => {
    const cases = combinationCases.flatMap(
      ([
        difficulty,
        { boardSizes, roundCount, entryLineCount, narrowRoundCount },
      ]) =>
        [
          [
            difficulty,
            "最も小さい盤面で連鎖が最も浅く入口が最も広い",
            toAnalysis(boardSizes[0]!, {
              roundCount: roundCount.minimum,
              entryLineCount: Math.min(
                entryLineCount.maximum,
                boardSizes[0]!.width + boardSizes[0]!.height,
              ),
              narrowRoundCount: narrowRoundCount.minimum,
            }),
          ],
          [
            difficulty,
            "最も大きい盤面で連鎖が最も深く入口が最も狭い",
            toAnalysis(boardSizes.at(-1)!, {
              roundCount: roundCount.maximum,
              entryLineCount: entryLineCount.minimum,
              narrowRoundCount: roundCount.maximum,
            }),
          ],
        ] as const,
    );

    test.each(cases)(
      "レベル %s の%s問題をそのレベルに分類すること",
      (difficulty, _, analysis) => {
        const result = assessNonogramDifficulty(analysis);

        expect(result).toEqual({ status: "classified", difficulty });
      },
    );
  });

  describe("連鎖の深さは合うが入口が上限より広い問題", () => {
    const cases = combinationCases
      .filter(([, { entryLineCount }]) =>
        Number.isFinite(entryLineCount.maximum),
      )
      .map(
        ([
          difficulty,
          { boardSizes, roundCount, entryLineCount, narrowRoundCount },
        ]) =>
          [
            difficulty,
            toAnalysis(boardSizes[0]!, {
              roundCount: roundCount.minimum,
              entryLineCount: entryLineCount.maximum + 1,
              narrowRoundCount: narrowRoundCount.minimum,
            }),
          ] as const,
      );

    test.each(cases)(
      "レベル %s に分類せず提供範囲外とすること",
      (_, analysis) => {
        const result = assessNonogramDifficulty(analysis);

        expect(result).toEqual({
          status: "out-of-range",
          reason: "unlisted-combination",
        });
      },
    );
  });

  describe("連鎖の深さは合うが細い段が下限より少ない問題", () => {
    const cases = combinationCases
      .filter(([, { narrowRoundCount }]) => narrowRoundCount.minimum > 0)
      .map(
        ([difficulty, { boardSizes, roundCount, narrowRoundCount }]) =>
          [
            difficulty,
            toAnalysis(boardSizes[0]!, {
              roundCount: roundCount.minimum,
              entryLineCount: 0,
              narrowRoundCount: narrowRoundCount.minimum - 1,
            }),
          ] as const,
      );

    test.each(cases)(
      "レベル %s に分類せず提供範囲外とすること",
      (_, analysis) => {
        const result = assessNonogramDifficulty(analysis);

        expect(result).toMatchObject({ status: "out-of-range" });
      },
    );
  });

  describe("盤面はレベル5の大きさだが連鎖が浅い問題", () => {
    const analysis = toAnalysis(
      { width: 10, height: 15 },
      { roundCount: 6, entryLineCount: 4, narrowRoundCount: 3 },
    );

    test("上のレベルにも下のレベルにも押し込まず提供範囲外とすること", () => {
      const result = assessNonogramDifficulty(analysis);

      expect(result).toEqual({
        status: "out-of-range",
        reason: "unlisted-combination",
      });
    });
  });

  describe("連鎖の深さが最上位の上限より深い問題", () => {
    const { boardSizes, roundCount } = nonogramLevelCombinations["5"];
    const analysis = toAnalysis(boardSizes[0], {
      roundCount: roundCount.maximum + 1,
      entryLineCount: 3,
      narrowRoundCount: 5,
    });

    test("レベル5に押し込まず提供範囲外とすること", () => {
      const result = assessNonogramDifficulty(analysis);

      expect(result).toMatchObject({ status: "out-of-range" });
    });
  });

  describe("評価できない問題・成立しない問題", () => {
    const scale = { width: 7, height: 7, cellCount: 49 };
    const cases = [
      [
        "仮置きの要る問題を unsupported",
        { status: "unsupported", scale },
        { status: "unsupported" },
      ],
      [
        "解が2つ以上ある問題を invalid",
        { status: "invalid", reason: "multiple-solutions", scale },
        { status: "invalid" },
      ],
    ] as const;

    test.each(cases)("%s とすること", (_, analysis, expected) => {
      const result = assessNonogramDifficulty(analysis);

      expect(result).toEqual(expected);
    });
  });
});
