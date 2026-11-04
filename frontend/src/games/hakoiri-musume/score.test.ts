import {
  calculateHakoiriMusumePlayScore,
  calculateHakoiriMusumeSpeedFullScoreMs,
  calculateHakoiriMusumeTimeDeltaMs,
} from "@/games/hakoiri-musume/score";

/** 合意の易しい例（最短13手・準備6手）。基準時間は 10秒 + 13手 × 2.5秒 + 6手 × 2.5秒 = 57.5秒。 */
const easyExample = { optimalMoveCount: 13, preparationLength: 6 };

describe("calculateHakoiriMusumeSpeedFullScoreMs", () => {
  const cases = [
    ["易しい例（最短13手・準備6手）", easyExample, 57_500],
    [
      "横刀立馬（最短81手・準備40手）",
      { optimalMoveCount: 81, preparationLength: 40 },
      312_500,
    ],
    [
      "レベル4 の代表（最短29手・準備25手）",
      { optimalMoveCount: 29, preparationLength: 25 },
      145_000,
    ],
    [
      "レベル5 の代表（最短36手・準備34手）",
      { optimalMoveCount: 36, preparationLength: 34 },
      185_000,
    ],
  ] as const;

  test.each(cases)(
    "盤面を読む時間・最短手数・準備の長さから基準時間を決めること: %s",
    (_, workload, expected) => {
      const fullScoreMs = calculateHakoiriMusumeSpeedFullScoreMs(workload);

      expect(fullScoreMs).toBe(expected);
    },
  );
});

describe("calculateHakoiriMusumePlayScore", () => {
  const cases = [
    ["最短手数で基準時間以内", 13, 50_000, { efficiency: 70, speed: 30 }],
    [
      "最短より7手多く基準時間を22.5秒超えた",
      20,
      80_000,
      { efficiency: 50, speed: 18 },
    ],
    ["最短の2倍に5手足した手数", 31, 50_000, { efficiency: 35, speed: 30 }],
    ["基準時間の2倍を超えた", 13, 120_000, { efficiency: 70, speed: 0 }],
  ] as const;

  test.each(cases)(
    "手数の少なさを中心に速さも見て採点すること: %s",
    (_, moveCount, elapsedMs, expected) => {
      const score = calculateHakoiriMusumePlayScore({
        elapsedMs,
        moveCount,
        ...easyExample,
      });

      expect(score.breakdown).toEqual(expected);
      expect(score.total).toBe(expected.efficiency + expected.speed);
    },
  );
});

describe("calculateHakoiriMusumeTimeDeltaMs", () => {
  test("基準時間との差を返すこと", () => {
    const delta = calculateHakoiriMusumeTimeDeltaMs({
      elapsedMs: 80_000,
      ...easyExample,
    });

    expect(delta).toBe(22_500);
  });
});
