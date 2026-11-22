import {
  getFlowedRatio,
  getLandedRatio,
  getPouredRatio,
  getPourTiming,
  LONGEST_POUR_DURATION_MS,
  POUR_FALL_MS,
} from "@/games/water-sort/ui/board/pour/pour-timing";

describe("getPourTiming", () => {
  const slotCounts = [1, 2, 3, 4] as const;

  test("注ぐ段が多いほど、注ぐ動きを長くすること", () => {
    const durations = slotCounts.map(
      (slotCount) => getPourTiming(slotCount).durationMs,
    );

    expect(durations).toEqual([...durations].sort((a, b) => a - b));
    expect(new Set(durations).size).toBe(slotCounts.length);
  });

  const expectedDurations = [
    [1, 920],
    [3, 1400],
  ] as const;

  test.each(expectedDurations)(
    "%i段を注ぐ動きを %i ms にすること",
    (slotCount, expected) => {
      const timing = getPourTiming(slotCount);

      expect(timing.durationMs).toBe(expected);
    },
  );

  test.each(slotCounts)(
    "口に触れる所は段の数によらず同じにすること: %i段",
    (slotCount) => {
      const timing = getPourTiming(slotCount);

      expect(timing.touchMs).toBe(getPourTiming(1).touchMs);
    },
  );

  test.each(slotCounts)(
    "流れが届ききってから栓を差し、栓が入りきってから注ぐ動きを終えること: %i段",
    (slotCount) => {
      const timing = getPourTiming(slotCount);

      expect(timing.landEndMs).toBeLessThan(timing.stopperStartMs);
      expect(timing.stopperSeatedMs).toBeLessThan(timing.durationMs);
    },
  );

  test("いちばん長い注ぎは4段を注ぐときであること", () => {
    const timing = getPourTiming(4);

    expect(LONGEST_POUR_DURATION_MS).toBe(timing.durationMs);
  });
});

describe("getFlowedRatio", () => {
  const progresses = Array.from({ length: 21 }, (_, index) => index / 20);

  test("出始めから出終わりまで、出た量が減らずに0から1まで増えること", () => {
    const ratios = progresses.map(getFlowedRatio);

    expect(ratios[0]).toBe(0);
    expect(ratios[ratios.length - 1]).toBeCloseTo(1);
    for (let index = 1; index < ratios.length; index += 1) {
      expect(ratios[index]).toBeGreaterThanOrEqual(ratios[index - 1] ?? 0);
    }
  });
});

describe("getLandedRatio", () => {
  const timing = getPourTiming(2);
  const elapsedMs = timing.touchMs + 200;

  test("口から出た液が、落ちる分だけ遅れて注ぎ先に届くこと", () => {
    const landed = getLandedRatio(timing, elapsedMs + POUR_FALL_MS);

    expect(landed).toBeCloseTo(getPouredRatio(timing, elapsedMs));
  });

  test("流れの先が届く前は、注ぎ先の液を増やさないこと", () => {
    const landed = getLandedRatio(timing, timing.landStartMs - 1);

    expect(landed).toBe(0);
  });
});
