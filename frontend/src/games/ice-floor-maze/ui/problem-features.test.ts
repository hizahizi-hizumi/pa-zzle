import { formatIceFloorMazeProblemFeatures } from "@/games/ice-floor-maze/ui/problem-features";

describe("formatIceFloorMazeProblemFeatures", () => {
  test("盤面の行と列の数と、もろい岩と薄い氷の数を示すこと", () => {
    const features = formatIceFloorMazeProblemFeatures({
      rows: 12,
      columns: 10,
      floorCount: 0,
      brittleRockCount: 3,
      thinIceCount: 5,
      snowCount: 0,
      slidingBlockCount: 0,
    });

    expect(features).toEqual([
      { label: "盤面", value: "12行×10列" },
      { label: "もろい岩", value: "3個" },
      { label: "薄い氷", value: "5マス" },
    ]);
  });

  test("雪と滑る氷の塊の数を示すこと", () => {
    const features = formatIceFloorMazeProblemFeatures({
      rows: 9,
      columns: 9,
      floorCount: 0,
      brittleRockCount: 0,
      thinIceCount: 0,
      snowCount: 2,
      slidingBlockCount: 1,
    });

    expect(features).toEqual([
      { label: "盤面", value: "9行×9列" },
      { label: "雪", value: "2マス" },
      { label: "滑る氷の塊", value: "1個" },
    ]);
  });

  test("要素の無い問題では、要素の数を示さないこと", () => {
    const features = formatIceFloorMazeProblemFeatures({
      rows: 8,
      columns: 8,
      floorCount: 0,
      brittleRockCount: 0,
      thinIceCount: 0,
      snowCount: 0,
      slidingBlockCount: 0,
    });

    expect(features).toEqual([{ label: "盤面", value: "8行×8列" }]);
  });
});
