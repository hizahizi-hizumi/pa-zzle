import { getParkingJamDirectionControls } from "@/games/parking-jam/ui/board/ParkingJamDirectionMark";

describe("getParkingJamDirectionControls", () => {
  // 8 マスの盤面（余白を含めて 980）を幅 351px に収めたときの、盤面の 1 単位の大きさ。
  const pixelsPerUnit = 351 / 980;
  const vehicles = [
    {
      id: "short-horizontal",
      row: 2,
      column: 1,
      orientation: "horizontal",
      length: 2,
    },
    {
      id: "long-vertical",
      row: 0,
      column: 3,
      orientation: "vertical",
      length: 3,
    },
  ] as const;

  test.each(vehicles)(
    "押せる範囲を小さな画面でも44px四方以上にすること: $id",
    (vehicle) => {
      const controls = getParkingJamDirectionControls(vehicle);

      for (const { hitArea } of controls) {
        expect(hitArea.width * pixelsPerUnit).toBeGreaterThanOrEqual(44);
        expect(hitArea.height * pixelsPerUnit).toBeGreaterThanOrEqual(44);
      }
    },
  );

  test.each(vehicles)(
    "押せる範囲がそれぞれの矢印の印を含むこと: $id",
    (vehicle) => {
      const controls = getParkingJamDirectionControls(vehicle);

      for (const { cx, cy, hitArea } of controls) {
        expect(cx).toBeGreaterThanOrEqual(hitArea.x);
        expect(cx).toBeLessThanOrEqual(hitArea.x + hitArea.width);
        expect(cy).toBeGreaterThanOrEqual(hitArea.y);
        expect(cy).toBeLessThanOrEqual(hitArea.y + hitArea.height);
      }
    },
  );

  test.each(vehicles)("前後の押せる範囲を重ねないこと: $id", (vehicle) => {
    const [backward, forward] = getParkingJamDirectionControls(vehicle).map(
      ({ hitArea }) => hitArea,
    );

    const separated =
      backward !== undefined &&
      forward !== undefined &&
      (backward.x + backward.width <= forward.x ||
        backward.y + backward.height <= forward.y);

    expect(separated).toBe(true);
  });
});
