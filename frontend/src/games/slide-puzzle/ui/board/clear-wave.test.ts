import { getClearWaveTileDelayMs } from "@/games/slide-puzzle/ui/board/clear-wave";

describe("getClearWaveTileDelayMs", () => {
  const tileCounts = [8, 15, 24];

  test.each(tileCounts)(
    "%d枚でも最初の木片は滑り終えてから沈み始めること",
    (count) => {
      const delay = getClearWaveTileDelayMs(0, count);

      expect(delay).toBeGreaterThan(190);
    },
  );

  test.each(tileCounts)(
    "%d枚でも最後の木片がほぼ同じ時点に収まること",
    (count) => {
      const first = getClearWaveTileDelayMs(0, count);
      const last = getClearWaveTileDelayMs(count - 1, count);

      expect(last - first).toBe(310);
    },
  );

  test.each(tileCounts)("%d枚の木片が番号順に沈み始めること", (count) => {
    const delays = Array.from({ length: count }, (_, order) =>
      getClearWaveTileDelayMs(order, count),
    );

    expect(
      delays.every((delay, order) => order === 0 || delay > delays[order - 1]!),
    ).toBe(true);
  });
});
