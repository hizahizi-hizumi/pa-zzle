import { getOpeningRipple } from "@/games/minesweeper/ui/board/opening-ripple";

describe("getOpeningRipple", () => {
  describe("押したマスの周りが少しだけ開いた場合", () => {
    const columns = 9;
    const openedCellIndices = [40, 41, 31, 42, 22];

    test("押したマスから1周離れるごとに14msずつ遅らせること", () => {
      const { delayByCellIndex, spreadMs } = getOpeningRipple(
        columns,
        40,
        openedCellIndices,
      );

      expect(Object.fromEntries(delayByCellIndex)).toEqual({
        40: 0,
        41: 14,
        31: 14,
        42: 28,
        22: 28,
      });
      expect(spreadMs).toBe(28);
    });
  });

  describe("盤面の端から端まで連鎖して開いた場合", () => {
    const columns = 30;
    const openedCellIndices = [0, 15, 29];

    test("最後のマスが開き始めるまでを200msに収めること", () => {
      const { delayByCellIndex, spreadMs } = getOpeningRipple(
        columns,
        0,
        openedCellIndices,
      );

      expect(spreadMs).toBe(200);
      expect(delayByCellIndex.get(15)).toBe(103);
    });
  });
});
