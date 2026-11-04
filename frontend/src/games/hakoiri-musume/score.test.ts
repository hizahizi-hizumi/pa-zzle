import {
  calculateHakoiriMusumePlayScore,
  calculateHakoiriMusumeSpeedFullScoreMs,
  calculateHakoiriMusumeTimeDeltaMs,
} from "@/games/hakoiri-musume/score";

describe("calculateHakoiriMusumeSpeedFullScoreMs", () => {
  const cases = [
    ["易しい例（最短13手）", 13, 67_000],
    ["横刀立馬（最短81手）", 81, 339_000],
  ] as const;

  test.each(cases)(
    "盤面を読む時間と最短手数から基準時間を決めること: %s",
    (_, optimalMoveCount, expected) => {
      const fullScoreMs = calculateHakoiriMusumeSpeedFullScoreMs({
        optimalMoveCount,
      });

      expect(fullScoreMs).toBe(expected);
    },
  );
});

describe("calculateHakoiriMusumePlayScore", () => {
  const cases = [
    ["最短手数で基準時間以内", 13, 60_000, { efficiency: 70, speed: 30 }],
    [
      "最短より7手多く基準時間を13秒超えた",
      20,
      80_000,
      { efficiency: 50, speed: 24 },
    ],
    ["最短の2倍に5手足した手数", 31, 60_000, { efficiency: 35, speed: 30 }],
    ["基準時間の2倍を超えた", 13, 140_000, { efficiency: 70, speed: 0 }],
  ] as const;

  test.each(cases)(
    "手数の少なさを中心に速さも見て採点すること: %s",
    (_, moveCount, elapsedMs, expected) => {
      const score = calculateHakoiriMusumePlayScore({
        elapsedMs,
        moveCount,
        optimalMoveCount: 13,
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
      optimalMoveCount: 13,
    });

    expect(delta).toBe(13_000);
  });
});
