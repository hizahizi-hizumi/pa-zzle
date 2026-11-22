import { _private } from "@/games/water-sort/ui/use-water-sort-sound-effects";

const { getSealRingPlaybackRate } = _private;

describe("getSealRingPlaybackRate", () => {
  describe("色が音階の段より少ない盤面の場合", () => {
    const sealedOne = [[0, 0, 0, 0], [1, 2, 1], [2, 1, 2], []];
    const sealedTwo = [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [2, 2],
      [2, 2],
    ];
    const sealedAll = [[0, 0, 0, 0], [1, 1, 1, 1], [2, 2, 2, 2], []];

    test("そろった試験管が増えるたびに、音階を1段ずつ上がること", () => {
      const rates = [sealedOne, sealedTwo, sealedAll].map((state) =>
        getSealRingPlaybackRate(state),
      );

      expect(rates).toEqual([1, 2 ** (2 / 12), 2 ** (4 / 12)]);
    });
  });

  describe("色が音階の段より多い盤面の場合", () => {
    const colors = Array.from({ length: 12 }, (_, color) => color);
    const sealedCounts = [1, 6, 12];
    const states = sealedCounts.map((sealedCount) =>
      colors.map((color) =>
        color < sealedCount ? [color, color, color, color] : [color],
      ),
    );

    test("最初の1本を最も低い段、最後の1本を最も高い段で鳴らすこと", () => {
      const rates = states.map((state) => getSealRingPlaybackRate(state));

      expect(rates[0]).toBe(1);
      expect(rates[1]).toBeGreaterThan(1);
      expect(rates[2]).toBe(2 ** (16 / 12));
    });
  });
});
