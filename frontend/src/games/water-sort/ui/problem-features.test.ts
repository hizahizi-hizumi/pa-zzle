import { formatWaterSortProblemFeatures } from "@/games/water-sort/ui/problem-features";

describe("formatWaterSortProblemFeatures", () => {
  test("色の種類と空の試験管の本数を示すこと", () => {
    const features = formatWaterSortProblemFeatures({
      colorCount: 8,
      emptyBottleCount: 2,
    });

    expect(features).toEqual([
      { label: "色", value: "8種類" },
      { label: "空の試験管", value: "2本" },
    ]);
  });
});
