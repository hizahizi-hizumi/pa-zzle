import {
  calculateMagicSquarePlayScore,
  calculateMagicSquareSpeedFullScoreMs,
  calculateMagicSquareSpeedScoreRule,
  calculateMagicSquareTimeDeltaMs,
  MAGIC_SQUARE_CORRECTION_PENALTY,
  MAGIC_SQUARE_SCORE_MAXIMUMS,
  MAGIC_SQUARE_SPEED_INITIAL_RECOGNITION_MS,
  MAGIC_SQUARE_SPEED_PER_EMPTY_CELL_MS,
  MAGIC_SQUARE_SPEED_ZERO_SCORE_RATIO,
} from "@/games/magic-square/score";

const workload = { emptyCellCount: 8 };
const fullScoreMs =
  MAGIC_SQUARE_SPEED_INITIAL_RECOGNITION_MS +
  8 * MAGIC_SQUARE_SPEED_PER_EMPTY_CELL_MS;

describe("calculateMagicSquareSpeedFullScoreMs", () => {
  test("読み始めの時間に、空きマスごとの時間を足すこと", () => {
    const fullScore = calculateMagicSquareSpeedFullScoreMs(workload);

    expect(fullScore).toBe(fullScoreMs);
  });
});

describe("calculateMagicSquareSpeedScoreRule", () => {
  test("基準時間の決まった倍率で0点になる規則を返すこと", () => {
    const rule = calculateMagicSquareSpeedScoreRule(workload);

    expect(rule).toEqual({
      fullScoreMs,
      zeroScoreMs: fullScoreMs * MAGIC_SQUARE_SPEED_ZERO_SCORE_RATIO,
    });
  });
});

describe("calculateMagicSquareTimeDeltaMs", () => {
  test("クリア時間から基準時間を引いた差を返すこと", () => {
    const delta = calculateMagicSquareTimeDeltaMs({
      elapsedMs: fullScoreMs - 5_000,
      workload,
    });

    expect(delta).toBe(-5_000);
  });
});

describe("calculateMagicSquarePlayScore", () => {
  const cases = [
    [
      "基準時間以内で置き直しの無いプレイは満点",
      fullScoreMs,
      0,
      { speed: MAGIC_SQUARE_SCORE_MAXIMUMS.speed, accuracy: 30 },
    ],
    [
      "置き直し1回ごとに正確さを減らす",
      fullScoreMs,
      2,
      {
        speed: MAGIC_SQUARE_SCORE_MAXIMUMS.speed,
        accuracy: 30 - 2 * MAGIC_SQUARE_CORRECTION_PENALTY,
      },
    ],
    [
      "正確さは0点より下げない",
      fullScoreMs,
      20,
      { speed: MAGIC_SQUARE_SCORE_MAXIMUMS.speed, accuracy: 0 },
    ],
    [
      "基準時間の倍率に達すると速さは0点",
      fullScoreMs * MAGIC_SQUARE_SPEED_ZERO_SCORE_RATIO,
      0,
      { speed: 0, accuracy: 30 },
    ],
  ] as const;

  test.each(cases)(
    "%sにすること",
    (_, elapsedMs, correctionCount, expected) => {
      const score = calculateMagicSquarePlayScore({
        elapsedMs,
        correctionCount,
        workload,
      });

      expect(score).toEqual({
        total: expected.speed + expected.accuracy,
        breakdown: expected,
      });
    },
  );

  describe("4×4 の空き8マスの問題を、どれも基準時間内に解いた代表的なプレイ例", () => {
    // 置き直しの回数は、session の数え方でそのプレイが数える回数（session.test.ts）。
    const plays = [
      ["推理だけで置いたプレイ", 0, 100],
      ["列を埋めるマスで隣の数を押し間違えて、すぐ直したプレイ", 1, 97],
      ["2マス空いた列の組を1つ試し置きして外したプレイ", 2, 94],
      ["半分まで置いてから盤面を戻し、読み直したプレイ", 4, 88],
      ["1マス空いた列の数を、列が一致するまで試したプレイ", 14, 70],
    ] as const;

    test.each(plays)(
      "%sを、置き直し%i回で%i点にすること",
      (_, correctionCount, expected) => {
        const { total } = calculateMagicSquarePlayScore({
          elapsedMs: fullScoreMs,
          correctionCount,
          workload,
        });

        expect(total).toBe(expected);
      },
    );
  });

  test("満点の合計を100点にすること", () => {
    const total = Object.values(MAGIC_SQUARE_SCORE_MAXIMUMS).reduce(
      (sum, maximum) => sum + maximum,
      0,
    );

    expect(total).toBe(100);
  });
});
