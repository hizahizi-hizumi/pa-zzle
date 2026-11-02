import { formatHitofudePuzzleProblemFeatures } from "@/games/hitofude-puzzle/ui/problem-features";

describe("formatHitofudePuzzleProblemFeatures", () => {
  test("盤面の大きさと、穴の数を示すこと", () => {
    const features = formatHitofudePuzzleProblemFeatures({
      size: 7,
      holeCount: 5,
    });

    expect(features).toEqual([
      { label: "盤面", value: "7×7" },
      { label: "穴", value: "5マス" },
    ]);
  });
});
