import { formatBridgesProblemFeatures } from "@/games/bridges/ui/problem-features";

describe("formatBridgesProblemFeatures", () => {
  test("盤面の大きさと、島の数を示すこと", () => {
    const features = formatBridgesProblemFeatures({ size: 8, islandCount: 15 });

    expect(features).toEqual([
      { label: "盤面", value: "8×8" },
      { label: "島", value: "15個" },
    ]);
  });
});
