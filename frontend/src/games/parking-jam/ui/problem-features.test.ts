import { formatParkingJamProblemFeatures } from "@/games/parking-jam/ui/problem-features";

describe("formatParkingJamProblemFeatures", () => {
  test("駐車場の行と列の数と、車と植え込みの数を示すこと", () => {
    const features = formatParkingJamProblemFeatures({
      rows: 8,
      columns: 6,
      vehicleCount: 11,
      fixedAreaCount: 1,
    });

    expect(features).toEqual([
      { label: "駐車場", value: "8行×6列" },
      { label: "車", value: "11台" },
      { label: "植え込み", value: "1か所" },
    ]);
  });

  test("植え込みの無い問題では、植え込みを示さないこと", () => {
    const features = formatParkingJamProblemFeatures({
      rows: 6,
      columns: 6,
      vehicleCount: 8,
      fixedAreaCount: 0,
    });

    expect(features).toEqual([
      { label: "駐車場", value: "6行×6列" },
      { label: "車", value: "8台" },
    ]);
  });
});
