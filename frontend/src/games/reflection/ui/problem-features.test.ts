import { formatReflectionProblemFeatures } from "@/games/reflection/ui/problem-features";

describe("formatReflectionProblemFeatures", () => {
  test("盤面の大きさと、手持ちのピースの数を示すこと", () => {
    const features = formatReflectionProblemFeatures({
      size: 7,
      pieceCount: 12,
    });

    expect(features).toEqual([
      { label: "盤面", value: "7×7" },
      { label: "ピース", value: "12個" },
    ]);
  });
});
