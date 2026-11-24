import { formatShuttleParkingProblemFeatures } from "@/games/shuttle-parking/ui/problem-features";

describe("formatShuttleParkingProblemFeatures", () => {
  test("駐車場の大きさ・待機枠の数・乗客の人数を、この順で示すこと", () => {
    const features = formatShuttleParkingProblemFeatures({
      lotSize: 7,
      bayCount: 3,
      passengerCount: 20,
    });

    expect(features).toEqual([
      { label: "駐車場", value: "7×7" },
      { label: "待機枠", value: "3か所" },
      { label: "乗客", value: "20人" },
    ]);
  });
});
