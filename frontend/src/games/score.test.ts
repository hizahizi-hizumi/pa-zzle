import {
  calculateLinearScore,
  calculateSpeedFloorScore,
  calculateSpeedScore,
  createSpeedScoreRule,
  _private,
  subtractWithFloor,
} from "@/games/score";

const { SPEED_SCORE_CURVE_KNEE_RATIO, calculateSpeedScoreRatio } = _private;

describe("calculateLinearScore", () => {
  const maximum = 40;
  const cases = [
    [1, 40],
    [0.5, 20],
    [0.51, 20],
    [0.52, 21],
    [0, 0],
    [1.5, 40],
    [-0.5, 0],
  ] as const;

  test.each(cases)("達成比率 %d を %i 点にすること", (ratio, expected) => {
    const score = calculateLinearScore(maximum, ratio);

    expect(score).toBe(expected);
  });
});

describe("subtractWithFloor", () => {
  const maximum = 20;
  const cases = [
    [0, 20],
    [5, 15],
    [20, 0],
    [25, 0],
  ] as const;

  test.each(cases)("減点 %i を %i 点にすること", (penalty, expected) => {
    const score = subtractWithFloor(maximum, penalty);

    expect(score).toBe(expected);
  });
});

describe("calculateSpeedScore", () => {
  const fullScoreMs = 60_000;

  describe("直線なら基準時間の3倍で0点になる規則の場合", () => {
    const rule = createSpeedScoreRule(fullScoreMs, 3);
    const cases = [
      [0.5, 100],
      [1, 100],
      [1.2, 90],
      [1.5, 75],
      [1.6, 70],
      [2, 55],
      [3, 40],
      [5, 35],
      [1_000, 35],
    ] as const;

    test.each(cases)(
      "基準時間の %d 倍で100点満点の %i 点にすること",
      (ratio, expected) => {
        const score = calculateSpeedScore(100, fullScoreMs * ratio, rule);

        expect(score).toBe(expected);
      },
    );
  });

  describe("直線なら基準時間の2倍で0点になる規則の場合", () => {
    const rule = createSpeedScoreRule(fullScoreMs, 2);
    const cases = [
      [1, 40],
      [1.25, 30],
      [1.5, 22],
      [2, 16],
      [3, 14],
      [1_000, 14],
    ] as const;

    test.each(cases)(
      "基準時間の %d 倍で40点満点の %i 点にすること",
      (ratio, expected) => {
        const score = calculateSpeedScore(40, fullScoreMs * ratio, rule);

        expect(score).toBe(expected);
      },
    );
  });

  describe("超過時間を1分刻みで数える規則の場合", () => {
    const rule = {
      fullScoreMs,
      zeroScoreMs: fullScoreMs + 40 * 60_000,
      overtimeStepMs: 60_000,
    };
    const cases = [
      [1, 39],
      [12 * 60_000, 28],
    ] as const;

    test.each(cases)(
      "超過 %i ミリ秒を刻みで切り上げて %i 点にすること",
      (overtimeMs, expected) => {
        const score = calculateSpeedScore(40, fullScoreMs + overtimeMs, rule);

        expect(score).toBe(expected);
      },
    );
  });

  describe("極端に長くかかった場合", () => {
    const rule = createSpeedScoreRule(fullScoreMs, 2);
    const maximums = [40, 60, 80, 100] as const;

    test.each(maximums)("配点 %i でも下限の点を残すこと", (maximum) => {
      const score = calculateSpeedScore(maximum, Number.MAX_SAFE_INTEGER, rule);

      expect(score).toBe(calculateSpeedFloorScore(maximum));
    });
  });
});

describe("calculateSpeedScoreRatio", () => {
  describe("切り替えまでの超過の場合", () => {
    const overtimeRatios = [0, 0.1, 0.2, 0.3] as const;

    test.each(overtimeRatios)(
      "超過の度合い %d では直線のままにすること",
      (overtimeRatio) => {
        const ratio = calculateSpeedScoreRatio(overtimeRatio);

        expect(ratio).toBeCloseTo(1 - overtimeRatio, 10);
      },
    );
  });

  describe("切り替えより先の超過の場合", () => {
    const overtimeRatios = [0.31, 0.5, 1, 2, 5] as const;

    test.each(overtimeRatios)(
      "超過の度合い %d では直線より高く、切り替えの割合を超えないこと",
      (overtimeRatio) => {
        const ratio = calculateSpeedScoreRatio(overtimeRatio);

        expect(ratio).toBeGreaterThan(1 - overtimeRatio);
        expect(ratio).toBeLessThan(SPEED_SCORE_CURVE_KNEE_RATIO);
      },
    );
  });

  describe("同じ幅ずつ遅くなる場合", () => {
    const overtimeRatios = [0.2, 0.4, 0.6, 0.8, 1, 1.2];

    test("遅いほど割合を下げ、下げ幅は長くかかるほど小さくすること", () => {
      const ratios = overtimeRatios.map(calculateSpeedScoreRatio);
      const drops = ratios
        .slice(1)
        .map((ratio, index) => (ratios[index] ?? 0) - ratio);

      expect(drops.every((drop) => drop > 0)).toBe(true);
      expect(
        drops.every(
          (drop, index) =>
            index === 0 || drop <= (drops[index - 1] ?? 0) + 1e-12,
        ),
      ).toBe(true);
    });
  });
});
