import { formatHakoiriMusumeProblemFeatures } from "@/games/hakoiri-musume/ui/problem-features";

describe("formatHakoiriMusumeProblemFeatures", () => {
  test("盤・娘・出口の幅・L字・壁と、娘ごとの出口、駒の組と空きを示すこと", () => {
    const features = formatHakoiriMusumeProblemFeatures({
      rows: 5,
      columns: 4,
      targetCount: 2,
      bendCount: 1,
      wallCount: 0,
      exitWidth: 2,
      exits: [
        { side: "bottom", width: 2 },
        { side: "top", width: 2 },
      ],
      horizontalCount: 1,
      verticalCount: 2,
      smallCount: 4,
      squareCount: 0,
      emptyCellCount: 4,
      emptyGroupCount: 2,
    });

    expect(features).toEqual([
      { label: "盤", value: "5行×4列" },
      { label: "娘", value: "2個" },
      { label: "出口の幅", value: "2マス" },
      { label: "L字", value: "1個" },
      { label: "壁", value: "0マス" },
      { label: "出口", value: "下 2マス、上 2マス" },
      { label: "横長", value: "1個" },
      { label: "縦長", value: "2個" },
      { label: "小駒", value: "4個" },
      { label: "空き", value: "4マス" },
      { label: "空きのかたまり", value: "2か所" },
    ]);
  });
});
