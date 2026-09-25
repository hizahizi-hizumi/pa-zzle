import {
  assessMinesweeperDifficulty,
  isInMinesweeperDifficultyBoardRange,
  listMinesweeperDifficultyBoardConditions,
  type MinesweeperBoardSize,
  type MinesweeperDifficulty,
  minesweeperDifficulties,
  parseMinesweeperDifficulty,
} from "@/games/minesweeper/difficulty";
import type {
  MinesweeperDifficultyAnalysis,
  MinesweeperHumanSolveFeatures,
  MinesweeperScaleMetrics,
} from "@/games/minesweeper/problem/difficulty-analysis";
import { restoreMinesweeperProblem } from "@/games/minesweeper/problem/generator";
import type { MinesweeperProblemIdentity } from "@/games/minesweeper/problem/problem";
import {
  listMinesweeperPoolEntries,
  toMinesweeperPoolIdentity,
} from "@/games/minesweeper/problem/problem-pool";

type AnalyzedProblem = {
  analysis: MinesweeperDifficultyAnalysis;
  boardSize: MinesweeperBoardSize;
};

function analyzeIdentity(
  identity: MinesweeperProblemIdentity,
): AnalyzedProblem {
  const { rows, columns } = identity.conditions;
  return {
    analysis: restoreMinesweeperProblem(identity).difficultyAnalysis,
    boardSize: { rows, columns },
  };
}

/** 問題集合の分析で使った `ms-<rows>x<columns>-<mines>-<index>` 形式の seed から問題を分析する。 */
function analyzeCorpusProblem(seed: string): AnalyzedProblem {
  const [rows, columns, mineCount] = /^ms-(\d+)x(\d+)-(\d+)-\d+$/
    .exec(seed)!
    .slice(1)
    .map(Number);
  return analyzeIdentity({
    generatorVersion: "1",
    seed,
    conditions: {
      rows: rows!,
      columns: columns!,
      mineCount: mineCount!,
      startCellPlacement: "random",
    },
    generationAttempt: 1,
  });
}

const difficultyIds = minesweeperDifficulties.map(
  (difficulty) => difficulty.id,
);

const providedScale: MinesweeperScaleMetrics = {
  cellCount: 100,
  mineCount: 15,
  mineDensity: 0.15,
  initialRevealedCellCount: 20,
  initialRevealedSafeCellRatio: 20 / 85,
  safeCellCountToReveal: 65,
};

const providedBoardSize: MinesweeperBoardSize = { rows: 10, columns: 10 };

const level1Features: MinesweeperHumanSolveFeatures = {
  highestDeductionLevel: 1,
  roundCountByDeductionLevel: { 1: 10, 2: 0, 3: 0, 4: 0, 5: 0 },
  overlapOrHarderRoundCount: 0,
  maximumInferenceWidth: 1,
  roundCount: 10,
  meanDiscoveryCount: 3,
  minimumDiscoveryCount: 1,
  singleDiscoveryRoundCount: 1,
  singleLocationRoundCount: 1,
  totalMineCountUsage: "none",
  maximumDiscoveryRowSpan: 3,
  maximumDiscoveryColumnSpan: 3,
  containmentEquivalentRoundCount: 0,
  overlapEquivalentRoundCount: 0,
  multiNumberTotalMineCountRoundCount: 0,
  chainedGroupRoundCount: 0,
};

describe("parseMinesweeperDifficulty", () => {
  const definedCases = ["1", "2", "3", "4", "5"] as const;
  const undefinedCases = [undefined, "", "0", "6", "easy"] as const;

  test.each(definedCases)(
    "%s を定義済みの難易度として受理すること",
    (input) => {
      const result = parseMinesweeperDifficulty(input);

      expect(result).toBe(input);
    },
  );

  test.each(undefinedCases)(
    "%s を未定義の難易度として拒否すること",
    (input) => {
      const result = parseMinesweeperDifficulty(input);

      expect(result).toBeUndefined();
    },
  );
});

describe("listMinesweeperDifficultyBoardConditions", () => {
  test("難易度1の盤面サイズごとに密度11〜13%に入る地雷数を並べること", () => {
    const result = listMinesweeperDifficultyBoardConditions("1");

    expect(result).toEqual([
      { rows: 9, columns: 9, mineCount: 9 },
      { rows: 9, columns: 9, mineCount: 10 },
      { rows: 10, columns: 9, mineCount: 10 },
      { rows: 10, columns: 9, mineCount: 11 },
      { rows: 10, columns: 10, mineCount: 11 },
      { rows: 10, columns: 10, mineCount: 12 },
      { rows: 10, columns: 10, mineCount: 13 },
    ]);
  });

  test.each(difficultyIds)(
    "難易度%sの候補を全て盤面範囲内とすること",
    (difficulty) => {
      const conditions = listMinesweeperDifficultyBoardConditions(difficulty);

      expect(conditions.length).toBeGreaterThan(0);
      for (const condition of conditions) {
        expect(isInMinesweeperDifficultyBoardRange(difficulty, condition)).toBe(
          true,
        );
      }
    },
  );

  test.each(difficultyIds)(
    "難易度%sの盤面を最大16行×12列の正方形か縦長にすること",
    (difficulty) => {
      const conditions = listMinesweeperDifficultyBoardConditions(difficulty);

      for (const { rows, columns } of conditions) {
        expect(rows).toBeGreaterThanOrEqual(columns);
        expect(rows).toBeLessThanOrEqual(16);
        expect(columns).toBeLessThanOrEqual(12);
      }
    },
  );

  test("2段階以上離れた難易度同士で盤面サイズと地雷数の組を重ねないこと", () => {
    const pairs = difficultyIds.flatMap((lower, lowerIndex) =>
      difficultyIds
        .slice(lowerIndex + 2)
        .map((higher) => [lower, higher] as const),
    );

    for (const [lower, higher] of pairs) {
      for (const condition of listMinesweeperDifficultyBoardConditions(lower)) {
        expect(isInMinesweeperDifficultyBoardRange(higher, condition)).toBe(
          false,
        );
      }
    }
  });
});

describe("isInMinesweeperDifficultyBoardRange", () => {
  const cases: [
    string,
    MinesweeperDifficulty,
    { rows: number; columns: number; mineCount: number },
    boolean,
  ][] = [
    [
      "定義された盤面サイズで密度の下限",
      "1",
      { rows: 10, columns: 10, mineCount: 11 },
      true,
    ],
    [
      "定義された盤面サイズで密度の上限",
      "1",
      { rows: 10, columns: 10, mineCount: 13 },
      true,
    ],
    [
      "密度が下限を下回る",
      "1",
      { rows: 10, columns: 10, mineCount: 10 },
      false,
    ],
    [
      "密度が上限を上回る",
      "1",
      { rows: 10, columns: 10, mineCount: 14 },
      false,
    ],
    [
      "定義されていない盤面サイズ",
      "1",
      { rows: 12, columns: 10, mineCount: 15 },
      false,
    ],
    ["横長の盤面サイズ", "4", { rows: 10, columns: 12, mineCount: 20 }, false],
  ];

  test.each(cases)(
    "%sを難易度%sの範囲で判定すること",
    (_name, difficulty, condition, expected) => {
      const result = isInMinesweeperDifficultyBoardRange(difficulty, condition);

      expect(result).toBe(expected);
    },
  );
});

describe("assessMinesweeperDifficulty", () => {
  describe("推論で決まる難易度の盤面範囲に入る問題の場合", () => {
    const cases = minesweeperDifficulties.map(({ id: difficulty }) => {
      const identity = toMinesweeperPoolIdentity(
        difficulty,
        listMinesweeperPoolEntries(difficulty)[0]!,
      );
      return [identity.seed, analyzeIdentity(identity), difficulty] as const;
    });

    test.each(cases)(
      "%s を難易度 %s に分類すること",
      (_seed, { analysis, boardSize }, difficulty) => {
        const result = assessMinesweeperDifficulty(analysis, boardSize);

        expect(result).toEqual({ status: "classified", difficulty });
      },
    );
  });

  describe("推論で決まる難易度の盤面範囲に入らない問題の場合", () => {
    const cases = [
      ["ms-10x10-15-125", "1"],
      ["ms-10x10-18-151", "3"],
      ["ms-10x10-18-377", "4"],
      ["ms-10x10-18-342", "4"],
      ["ms-10x10-23-351", "4"],
      ["ms-12x10-25-290", "5"],
      ["ms-14x10-25-224", "5"],
    ].map(
      ([seed, difficulty]) =>
        [seed!, analyzeCorpusProblem(seed!), difficulty] as const,
    );

    test.each(cases)(
      "%s を推論では難易度 %s だが盤面範囲外とすること",
      (_seed, { analysis, boardSize }, inferenceDifficulty) => {
        const result = assessMinesweeperDifficulty(analysis, boardSize);

        expect(result).toEqual({
          status: "out-of-range",
          reason: "outside-board-range",
          inferenceDifficulty,
        });
      },
    );
  });

  describe("問題集合の問題が推論で決まる難易度の盤面範囲に入る場合", () => {
    const cases = [
      ["ms-12x10-18-229", "2"],
      ["ms-10x10-15-846", "2"],
      ["ms-10x10-15-819", "3"],
    ].map(
      ([seed, difficulty]) =>
        [seed!, analyzeCorpusProblem(seed!), difficulty] as const,
    );

    test.each(cases)(
      "%s を難易度 %s に分類すること",
      (_seed, { analysis, boardSize }, difficulty) => {
        const result = assessMinesweeperDifficulty(analysis, boardSize);

        expect(result).toEqual({ status: "classified", difficulty });
      },
    );
  });

  describe("単独の数字だけで解ける問題が大きすぎる盤面にある場合", () => {
    const analysis: MinesweeperDifficultyAnalysis = {
      status: "analyzed",
      scale: { ...providedScale, cellCount: 192, mineCount: 24 },
      features: level1Features,
    };

    test("推論では難易度1だが盤面範囲外とすること", () => {
      const result = assessMinesweeperDifficulty(analysis, {
        rows: 16,
        columns: 12,
      });

      expect(result).toEqual({
        status: "out-of-range",
        reason: "outside-board-range",
        inferenceDifficulty: "1",
      });
    });
  });

  describe("初期開示が広すぎる問題の場合", () => {
    const { analysis, boardSize } = analyzeCorpusProblem("ms-12x10-12-103");

    test("軽すぎる提供範囲外とすること", () => {
      const result = assessMinesweeperDifficulty(analysis, boardSize);

      expect(result).toEqual({ status: "out-of-range", reason: "too-light" });
    });
  });

  describe("ラウンド数が少なすぎる問題の場合", () => {
    const analysis: MinesweeperDifficultyAnalysis = {
      status: "analyzed",
      scale: providedScale,
      features: { ...level1Features, roundCount: 5 },
    };

    test("軽すぎる提供範囲外とすること", () => {
      const result = assessMinesweeperDifficulty(analysis, providedBoardSize);

      expect(result).toEqual({ status: "out-of-range", reason: "too-light" });
    });
  });

  describe("5つの数字を同時に考える推論を含む問題の場合", () => {
    const analysis: MinesweeperDifficultyAnalysis = {
      status: "analyzed",
      scale: providedScale,
      features: {
        ...level1Features,
        maximumInferenceWidth: 5,
        chainedGroupRoundCount: 1,
      },
    };

    test("重すぎる提供範囲外とすること", () => {
      const result = assessMinesweeperDifficulty(analysis, providedBoardSize);

      expect(result).toEqual({ status: "out-of-range", reason: "too-heavy" });
    });
  });

  describe("分析で評価できない問題の場合", () => {
    const analysis: MinesweeperDifficultyAnalysis = {
      status: "unsupported",
      reason: "computation-limit",
      scale: providedScale,
    };

    test("評価不能として理由を返すこと", () => {
      const result = assessMinesweeperDifficulty(analysis, providedBoardSize);

      expect(result).toEqual({
        status: "unsupported",
        reason: "computation-limit",
      });
    });
  });

  describe("推測が必要な問題の場合", () => {
    const analysis: MinesweeperDifficultyAnalysis = {
      status: "unsolvable",
      scale: providedScale,
    };

    test("成立しない問題として返すこと", () => {
      const result = assessMinesweeperDifficulty(analysis, providedBoardSize);

      expect(result).toEqual({ status: "unsolvable" });
    });
  });
});
