import { formatNanpureProblemFeatures } from "@/games/nanpure/ui/problem-features";

describe("formatNanpureProblemFeatures", () => {
  test("初期数字の数を示すこと", () => {
    const features = formatNanpureProblemFeatures({ clueCount: 28 });

    expect(features).toEqual([{ label: "初期数字", value: "28個" }]);
  });
});
