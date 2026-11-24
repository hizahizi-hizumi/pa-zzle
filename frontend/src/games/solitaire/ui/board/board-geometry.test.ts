import {
  emptySolitaireFoundations,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";
import {
  getSolitaireBoardGeometry,
  getSolitaireFixedBoardGeometry,
  getSolitairePileSlotIndex,
  getSolitairePileTopPosition,
  getSolitaireSlotLeft,
} from "@/games/solitaire/ui/board/board-geometry";

const shortColumns = [1, 2, 3, 4, 5, 6, 7];

describe("getSolitaireBoardGeometry", () => {
  describe("320px 幅で縦に余裕のある盤面の場合", () => {
    const input = {
      width: 320,
      height: 900,
      columnLengths: shortColumns,
    };

    test("左右 8px・列の間 4px を除いた幅を7列で分けた札の幅にすること", () => {
      const { cardWidth, cardHeight, contentWidth } =
        getSolitaireBoardGeometry(input);

      expect({ cardWidth, cardHeight, contentWidth }).toEqual({
        cardWidth: 40,
        cardHeight: 56,
        contentWidth: 304,
      });
    });

    test("どの列も札の高さの0.3倍ずつずらすこと", () => {
      const { columnOffsets } = getSolitaireBoardGeometry(input);

      expect(new Set(columnOffsets)).toEqual(new Set([56 * 0.3]));
    });

    test("上の段の札の下に 8px 空けて列を置くこと", () => {
      const { columnTop } = getSolitaireBoardGeometry(input);

      expect(columnTop).toBe(64);
    });
  });

  describe("縦に余裕の無い盤面に長い列がある場合", () => {
    const input = {
      width: 320,
      height: 300,
      columnLengths: [19, 2, 3, 4, 5, 6, 7],
    };

    test("入りきらない長い列だけ、ずらし幅を詰めて列の高さに収めること", () => {
      const { columnOffsets, columnHeight, cardHeight } =
        getSolitaireBoardGeometry(input);
      const [longOffset, ...shortOffsets] = columnOffsets;

      expect(longOffset! * 18 + cardHeight).toBeCloseTo(columnHeight);
      expect(new Set(shortOffsets)).toEqual(new Set([cardHeight * 0.3]));
    });
  });

  describe("縦に広い画面の場合", () => {
    const input = {
      width: 1200,
      height: 700,
      columnLengths: shortColumns,
    };

    test("13枚の列がずらし幅を詰めずに入る大きさまでに札を抑えること", () => {
      const { cardWidth, cardHeight, columnHeight, columnOffsets } =
        getSolitaireBoardGeometry(input);

      expect(cardHeight + 12 * columnOffsets[0]!).toBeLessThanOrEqual(
        columnHeight,
      );
      expect(cardWidth).toBeLessThan((1200 - 16 - 24) / 7);
    });
  });
});

describe("getSolitaireSlotLeft", () => {
  const input = {
    width: 320,
    height: 900,
    columnLengths: shortColumns,
  };

  test("7列の格子の左から数えた札の左端を返すこと", () => {
    const geometry = getSolitaireBoardGeometry(input);
    const lefts = [0, 3, 6].map((slot) => getSolitaireSlotLeft(geometry, slot));

    expect(lefts).toEqual([0, 132, 264]);
  });
});

describe("getSolitairePileSlotIndex", () => {
  describe("プレイ画面の盤面の場合", () => {
    const geometry = getSolitaireBoardGeometry({
      width: 320,
      height: 900,
      columnLengths: shortColumns,
    });
    const cases = [
      ["山札", { pile: "stock" }, 0],
      ["捨て札", { pile: "waste" }, 1],
      ["♠ の組札", { pile: "foundation", suit: "spades" }, 3],
      ["♣ の組札", { pile: "foundation", suit: "clubs" }, 6],
      ["列5", { pile: "column", columnIndex: 4 }, 4],
    ] as const;

    test.each(cases)("%sを格子の %i 番目に置くこと", (_, pile, expected) => {
      const slotIndex = getSolitairePileSlotIndex(geometry, pile);

      expect(slotIndex).toBe(expected);
    });
  });

  describe("並べる山を選んだ盤面の場合", () => {
    const geometry = getSolitaireFixedBoardGeometry({
      layout: {
        topRow: [{ pile: "foundation", suit: "hearts" }],
        columns: [3, 5],
      },
      cardWidth: 40,
      columnCardCapacity: 3,
    });
    const cases = [
      ["♥ の組札", { pile: "foundation", suit: "hearts" }, 0],
      ["列4", { pile: "column", columnIndex: 3 }, 0],
      ["列6", { pile: "column", columnIndex: 5 }, 1],
      ["並べない列", { pile: "column", columnIndex: 0 }, -1],
      ["並べない組札", { pile: "foundation", suit: "spades" }, -1],
    ] as const;

    test.each(cases)(
      "%sを、並べた順の格子の %i 番目に置くこと",
      (_, pile, expected) => {
        const slotIndex = getSolitairePileSlotIndex(geometry, pile);

        expect(slotIndex).toBe(expected);
      },
    );
  });
});

describe("getSolitaireFixedBoardGeometry", () => {
  test("並べる山の数の幅と、決めた枚数を詰めずに重ねる列の高さを取ること", () => {
    const { contentWidth, columnTop, columnHeight, columnOffsets } =
      getSolitaireFixedBoardGeometry({
        layout: {
          topRow: [{ pile: "foundation", suit: "hearts" }],
          columns: [3, 5],
        },
        cardWidth: 40,
        columnCardCapacity: 3,
      });

    expect({ contentWidth, columnTop }).toEqual({
      contentWidth: 84,
      columnTop: 64,
    });
    expect(columnHeight).toBeCloseTo(56 + 2 * 16.8);
    expect(new Set(columnOffsets)).toEqual(new Set([56 * 0.3]));
  });
});

describe("getSolitairePileTopPosition", () => {
  // 320px 幅では札は 40×56px、列の間は 4px、列の一番奥の札の上端は 64px、ずらし幅は 16.8px。
  const geometryInput = {
    width: 320,
    height: 900,
    columnLengths: [3, 0, 1, 1, 1, 1, 1],
  };
  const state: SolitaireState = {
    columns: [[0, 1, 2], [], [3], [4], [5], [6], [7]],
    stock: [],
    waste: [],
    foundations: emptySolitaireFoundations,
  };
  const cases = [
    [
      "3枚の列は一番手前の札",
      { pile: "column", columnIndex: 0 },
      0,
      64 + 2 * 16.8,
    ],
    ["空いた列は札を置く跡", { pile: "column", columnIndex: 1 }, 44, 64],
    ["捨て札は上の段の2番目", { pile: "waste" }, 44, 0],
    ["♥ の組札は上の段の5番目", { pile: "foundation", suit: "hearts" }, 176, 0],
  ] as const;

  test.each(cases)("%sの位置を返すこと", (_, pile, left, top) => {
    const position = getSolitairePileTopPosition(
      getSolitaireBoardGeometry(geometryInput),
      state,
      pile,
    );

    expect(position.left).toBe(left);
    expect(position.top).toBeCloseTo(top);
  });
});
