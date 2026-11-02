import {
  CLEAR_KING_DURATION_MS,
  CLEAR_SETTLE_MS,
  CLEAR_START_DELAY_MS,
  CLEAR_WAVE_DURATION_MS,
  CLEAR_WAVE_STAGGER_MS,
  measureTsumeShogiClearWaveReach,
  planTsumeShogiClearWave,
} from "@/games/tsume-shogi/ui/board/clear/clear-wave";

describe("planTsumeShogiClearWave", () => {
  describe("玉と、玉から1升・3升離れた駒がある場合", () => {
    const squares = [
      { square: { file: 5, rank: 5 }, matedKing: false },
      { square: { file: 3, rank: 4 }, matedKing: false },
      { square: { file: 2, rank: 4 }, matedKing: true },
    ];

    test("玉から近い順に、1升ごとに遅らせて立てること", () => {
      const plan = planTsumeShogiClearWave(squares);

      expect(plan.steps).toEqual([
        {
          square: { file: 2, rank: 4 },
          matedKing: true,
          delayMs: CLEAR_START_DELAY_MS,
          durationMs: CLEAR_KING_DURATION_MS,
        },
        {
          square: { file: 3, rank: 4 },
          matedKing: false,
          delayMs: CLEAR_START_DELAY_MS + CLEAR_WAVE_STAGGER_MS,
          durationMs: CLEAR_WAVE_DURATION_MS,
        },
        {
          square: { file: 5, rank: 5 },
          matedKing: false,
          delayMs: CLEAR_START_DELAY_MS + 3 * CLEAR_WAVE_STAGGER_MS,
          durationMs: CLEAR_WAVE_DURATION_MS,
        },
      ]);
    });

    test("最後の波が収まってから詰み上がりを見せ終えるまでを全体の長さにすること", () => {
      const plan = planTsumeShogiClearWave(squares);

      expect(plan.totalMs).toBe(
        Math.max(
          CLEAR_START_DELAY_MS + CLEAR_KING_DURATION_MS,
          CLEAR_START_DELAY_MS +
            3 * CLEAR_WAVE_STAGGER_MS +
            CLEAR_WAVE_DURATION_MS,
        ) + CLEAR_SETTLE_MS,
      );
    });
  });

  describe("玉が見つからない場合", () => {
    const squares = [{ square: { file: 5, rank: 5 }, matedKing: false }];

    test("波を立てず、詰み上がりを見せる時間だけを返すこと", () => {
      const plan = planTsumeShogiClearWave(squares);

      expect(plan).toEqual({
        steps: [],
        totalMs:
          CLEAR_START_DELAY_MS + CLEAR_KING_DURATION_MS + CLEAR_SETTLE_MS,
      });
    });
  });
});

describe("measureTsumeShogiClearWaveReach", () => {
  const cases = [
    ["盤の隅の 1一", { file: 1, rank: 1 }, 8],
    ["2三", { file: 2, rank: 3 }, 7],
    ["盤の中央の 5五", { file: 5, rank: 5 }, 4],
  ] as const;

  test.each(cases)(
    "玉の升 %s から盤のいちばん遠い升までの升の数を返すこと",
    (_, king, expected) => {
      const reach = measureTsumeShogiClearWaveReach(king);

      expect(reach).toBe(expected);
    },
  );
});
