import { formatSlidePuzzleProblemFeatures } from "@/games/slide-puzzle/ui/problem-features";

describe("formatSlidePuzzleProblemFeatures", () => {
  test("盤面の大きさを示すこと", () => {
    const features = formatSlidePuzzleProblemFeatures({ boardSize: 4 });

    expect(features).toEqual([{ label: "盤面", value: "4×4" }]);
  });
});
