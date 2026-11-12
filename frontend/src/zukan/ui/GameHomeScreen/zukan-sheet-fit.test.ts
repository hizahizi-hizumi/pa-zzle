import { fitZukanSheet } from "@/zukan/ui/GameHomeScreen/zukan-sheet-fit";

describe("fitZukanSheet", () => {
  describe("ピースの1辺の上限で幅いっぱいに並べても高さに収まる場合", () => {
    const width = 300;
    const height = 200;
    const pieceCount = 40;

    test("上限の大きさのピースで、幅いっぱいに並べること", () => {
      const fit = fitZukanSheet(width, height, pieceCount);

      expect(fit).toEqual({ columnCount: 10, pieceSize: 30 });
    });
  });

  describe("上限の大きさのピースでは高さに収まらない場合", () => {
    const width = 300;
    const height = 120;
    const pieceCount = 100;

    test("高さに収まるまで列を増やし、収まる最も少ない列の数で、幅を列の数で割った大きさのピースにすること", () => {
      const fit = fitZukanSheet(width, height, pieceCount);
      const rowCount = Math.ceil(pieceCount / (fit?.columnCount ?? 1));

      expect(fit?.columnCount).toBe(17);
      expect(fit?.pieceSize).toBeCloseTo(width / 17);
      expect(rowCount * (fit?.pieceSize ?? 0)).toBeLessThanOrEqual(height);
    });
  });

  describe("場所の大きさかピースの数が分からない場合", () => {
    const cases = [
      ["幅が0", 0, 200, 40],
      ["高さが0", 300, 0, 40],
      ["ピースが無い", 300, 200, 0],
    ] as const;

    test.each(cases)(
      "並べ方を返さないこと: %s",
      (_, width, height, pieceCount) => {
        const fit = fitZukanSheet(width, height, pieceCount);

        expect(fit).toBeNull();
      },
    );
  });
});
