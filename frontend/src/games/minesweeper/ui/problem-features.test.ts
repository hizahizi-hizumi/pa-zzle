import { formatMinesweeperProblemFeatures } from "@/games/minesweeper/ui/problem-features";

describe("formatMinesweeperProblemFeatures", () => {
  test("盤面の行と列の数と、地雷の数を示すこと", () => {
    const features = formatMinesweeperProblemFeatures({
      rows: 16,
      columns: 12,
      mineCount: 33,
    });

    expect(features).toEqual([
      { label: "盤面", value: "16行×12列" },
      { label: "地雷", value: "33個" },
    ]);
  });
});
