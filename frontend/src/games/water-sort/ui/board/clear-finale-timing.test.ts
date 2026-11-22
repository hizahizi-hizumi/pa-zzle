import { getClearFinaleDurationMs } from "@/games/water-sort/ui/board/clear-finale-timing";

describe("getClearFinaleDurationMs", () => {
  describe("14本の盤面（空の試験管2本、栓をした試験管12本）の場合", () => {
    const emptyCount = 2;
    const sealedCount = 12;

    test("最後の注ぎを終えてから約2秒で演出を終えること", () => {
      const durationMs = getClearFinaleDurationMs(emptyCount, sealedCount);

      expect(durationMs).toBeGreaterThanOrEqual(1500);
      expect(durationMs).toBeLessThanOrEqual(2000);
    });
  });

  describe("栓をした試験管の本数が違う場合", () => {
    const emptyCount = 2;

    test("本数が増えても、演出の長さが列を撫でる間合いの上限より延びないこと", () => {
      const fewTubes = getClearFinaleDurationMs(emptyCount, 2);
      const manyTubes = getClearFinaleDurationMs(emptyCount, 12);

      expect(manyTubes - fewTubes).toBeLessThanOrEqual(360);
    });
  });
});
