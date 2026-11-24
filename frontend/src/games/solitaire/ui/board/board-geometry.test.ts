import {
  getSolitaireBoardGeometry,
  getSolitaireSlotLeft,
} from "@/games/solitaire/ui/board/board-geometry";

const shortColumns = [1, 2, 3, 4, 5, 6, 7];

describe("getSolitaireBoardGeometry", () => {
  describe("320px 幅で縦に余裕のある盤面の場合", () => {
    const geometry = getSolitaireBoardGeometry({
      width: 320,
      height: 900,
      columnLengths: shortColumns,
    });

    test("左右 8px・列の間 4px を除いた幅を7列で分けた札の幅にすること", () => {
      const { cardWidth, cardHeight, contentWidth } = geometry;

      expect({ cardWidth, cardHeight, contentWidth }).toEqual({
        cardWidth: 40,
        cardHeight: 56,
        contentWidth: 304,
      });
    });

    test("どの列も札の高さの0.3倍ずつずらすこと", () => {
      const { columnOffsets } = geometry;

      expect(new Set(columnOffsets)).toEqual(new Set([56 * 0.3]));
    });

    test("上の段の札の下に 8px 空けて列を置くこと", () => {
      const { columnTop } = geometry;

      expect(columnTop).toBe(64);
    });
  });

  describe("縦に余裕の無い盤面に長い列がある場合", () => {
    const geometry = getSolitaireBoardGeometry({
      width: 320,
      height: 300,
      columnLengths: [19, 2, 3, 4, 5, 6, 7],
    });

    test("入りきらない長い列だけ、ずらし幅を詰めて列の高さに収めること", () => {
      const { columnOffsets, columnHeight, cardHeight } = geometry;
      const [longOffset, ...shortOffsets] = columnOffsets;

      expect(longOffset! * 18 + cardHeight).toBeCloseTo(columnHeight);
      expect(new Set(shortOffsets)).toEqual(new Set([cardHeight * 0.3]));
    });
  });

  describe("縦に広い画面の場合", () => {
    const geometry = getSolitaireBoardGeometry({
      width: 1200,
      height: 700,
      columnLengths: shortColumns,
    });

    test("13枚の列がずらし幅を詰めずに入る大きさまでに札を抑えること", () => {
      const { cardHeight, columnHeight, columnOffsets } = geometry;

      expect(cardHeight + 12 * columnOffsets[0]!).toBeLessThanOrEqual(
        columnHeight,
      );
      expect(geometry.cardWidth).toBeLessThan((1200 - 16 - 24) / 7);
    });
  });
});

describe("getSolitaireSlotLeft", () => {
  const geometry = getSolitaireBoardGeometry({
    width: 320,
    height: 900,
    columnLengths: shortColumns,
  });

  test("7列の格子の左から数えた札の左端を返すこと", () => {
    const lefts = [0, 3, 6].map((slot) => getSolitaireSlotLeft(geometry, slot));

    expect(lefts).toEqual([0, 132, 264]);
  });
});
