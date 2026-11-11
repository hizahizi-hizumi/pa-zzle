import { formatHakoiriMusumeProblemFeatures } from "@/games/hakoiri-musume/ui/problem-features";

describe("formatHakoiriMusumeProblemFeatures", () => {
  test("横長・縦長・小駒の数と、空きマスの数と、空きのかたまりの数を示すこと", () => {
    const features = formatHakoiriMusumeProblemFeatures({
      horizontalCount: 1,
      verticalCount: 2,
      smallCount: 4,
      emptyCellCount: 4,
      emptyGroupCount: 2,
    });

    expect(features).toEqual([
      { label: "横長", value: "1個" },
      { label: "縦長", value: "2個" },
      { label: "小駒", value: "4個" },
      { label: "空き", value: "4マス" },
      { label: "空きのかたまり", value: "2か所" },
    ]);
  });
});
