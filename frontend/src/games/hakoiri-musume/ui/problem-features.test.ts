import { formatHakoiriMusumeProblemFeatures } from "@/games/hakoiri-musume/ui/problem-features";

describe("formatHakoiriMusumeProblemFeatures", () => {
  test("横長と小駒の数と、空きのまとまりの数を示すこと", () => {
    const features = formatHakoiriMusumeProblemFeatures({
      horizontalCount: 1,
      smallCount: 4,
      emptyGroupCount: 2,
    });

    expect(features).toEqual([
      { label: "横長", value: "1個" },
      { label: "小駒", value: "4個" },
      { label: "空き", value: "2か所" },
    ]);
  });
});
