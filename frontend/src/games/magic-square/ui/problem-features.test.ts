import { formatMagicSquareProblemFeatures } from "@/games/magic-square/ui/problem-features";

describe("formatMagicSquareProblemFeatures", () => {
  test("盤面の大きさと最初から置いてある数の個数を書くこと", () => {
    const features = formatMagicSquareProblemFeatures({
      size: 5,
      givenCount: 11,
    });

    expect(features).toEqual([
      { label: "盤面", value: "5×5" },
      { label: "最初の数", value: "11個" },
    ]);
  });
});
