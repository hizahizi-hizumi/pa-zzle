import { describe, expect, test } from "vitest";

import { findZukanPieceLayout } from "@/zukan/ui/GameHomeScreen/zukan-piece-size";

describe("findZukanPieceLayout", () => {
  describe("全問を割り切る列の数が無く、狙う大きさに近い列の数がある場合", () => {
    // 6列なら59px、5列なら71px。97問はどちらでも割り切れない。
    const problemCount = 97;
    const areaWidth = 358;

    test("狙う大きさに近いピースになる列の数を選び、幅いっぱいに組むこと", () => {
      const layout = findZukanPieceLayout(problemCount, areaWidth);

      expect(layout).toEqual({ pieceSize: 59, columnCount: 6 });
    });
  });

  describe("全問を割り切る列の数のほうが、狙う大きさから少し離れる場合", () => {
    // 6列なら59px で狙う大きさに近いが、最後の段が4枚になる。全問を割り切る5列なら71px。
    const problemCount = 100;
    const areaWidth = 358;

    test("最後の段を欠けさせない、全問を割り切る列の数を選ぶこと", () => {
      const layout = findZukanPieceLayout(problemCount, areaWidth);

      expect(layout).toEqual({ pieceSize: 71, columnCount: 5 });
    });
  });

  describe("領域の幅が下限の大きさのピースを置ける場合", () => {
    const widths = [54, 320, 358, 390, 430, 768, 1024, 1500];
    const problemCounts = [1, 2, 13, 60, 97, 100, 120];
    const cases = widths.flatMap((areaWidth) =>
      problemCounts.map((problemCount) => [areaWidth, problemCount] as const),
    );

    test.each(cases)(
      "ピースを下限と上限の間の大きさにし、上限に届かなければ幅いっぱいに組むこと: 幅 %ipx・%i問",
      (areaWidth, problemCount) => {
        const layout = findZukanPieceLayout(problemCount, areaWidth);
        const pieceSize = layout?.pieceSize ?? 0;
        const columnCount = layout?.columnCount ?? 0;
        const isCapped = pieceSize === 84;

        expect(pieceSize).toBeGreaterThanOrEqual(54);
        expect(pieceSize).toBeLessThanOrEqual(84);
        expect(pieceSize * columnCount).toBeLessThanOrEqual(areaWidth);
        expect(isCapped || (pieceSize + 1) * columnCount > areaWidth).toBe(
          true,
        );
      },
    );
  });

  describe("問題数が少なく、上限の大きさのピースでも幅が余る場合", () => {
    const areaWidth = 400;
    const cases = [
      [1, 1],
      [2, 2],
      [4, 4],
    ] as const;

    test.each(cases)(
      "上限の大きさで止め、問題数より多い列を作らないこと: %i問",
      (problemCount, expectedColumnCount) => {
        const layout = findZukanPieceLayout(problemCount, areaWidth);

        expect(layout).toEqual({
          pieceSize: 84,
          columnCount: expectedColumnCount,
        });
      },
    );
  });

  describe("領域の幅が下限の大きさのピースも置けないほど狭い場合", () => {
    const problemCount = 100;
    const areaWidth = 53;

    test("1列にし、ピースを幅いっぱいの大きさにすること", () => {
      const layout = findZukanPieceLayout(problemCount, areaWidth);

      expect(layout).toEqual({ pieceSize: 53, columnCount: 1 });
    });
  });

  describe("問題数か領域の幅が0以下の場合", () => {
    const cases = [
      ["問題数が0", 0, 400],
      ["領域の幅が0", 10, 0],
      ["領域の幅が負", 10, -5],
    ] as const;

    test.each(cases)("null を返すこと: %s", (_, problemCount, areaWidth) => {
      const layout = findZukanPieceLayout(problemCount, areaWidth);

      expect(layout).toBeNull();
    });
  });
});
