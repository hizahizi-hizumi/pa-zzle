import { formatIceFloorMazeProblemFeatures } from "@/games/ice-floor-maze/ui/problem-features";

describe("formatIceFloorMazeProblemFeatures", () => {
  test("盤面の行と列の数と、もろい岩と薄い氷の数を示すこと", () => {
    const features = formatIceFloorMazeProblemFeatures({
      rows: 12,
      columns: 10,
      brittleRockCount: 3,
      thinIceCount: 5,
    });

    expect(features).toEqual([
      { label: "盤面", value: "12行×10列" },
      { label: "もろい岩", value: "3個" },
      { label: "薄い氷", value: "5マス" },
    ]);
  });

  test("もろい岩と薄い氷の無い問題では、それらを示さないこと", () => {
    const features = formatIceFloorMazeProblemFeatures({
      rows: 8,
      columns: 8,
      brittleRockCount: 0,
      thinIceCount: 0,
    });

    expect(features).toEqual([{ label: "盤面", value: "8行×8列" }]);
  });
});
