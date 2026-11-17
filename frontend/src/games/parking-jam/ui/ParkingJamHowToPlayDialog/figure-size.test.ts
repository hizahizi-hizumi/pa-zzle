import {
  _private,
  parkingJamExampleCellClassName,
} from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/figure-size";

const { goalWidthInCells } = _private;

describe("parkingJamExampleCellClassName", () => {
  test("狭い画面の例のマスを、ゴールの盤面を描く範囲の幅と同じマスの数で割って決めること", () => {
    const divisor = parkingJamExampleCellClassName.match(/\)\/([\d.]+)\)/)?.[1];

    expect(Number(divisor)).toBe(goalWidthInCells);
  });
});
