import { placeTsumeShogiPromotionPicker } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard/promotion-picker-placement";

describe("placeTsumeShogiPromotionPicker", () => {
  const cases = [
    [
      "盤の中ほどの移動先は、真上の段で成を同じ筋",
      { file: 5, rank: 3 },
      { column: 4, row: 1 },
    ],
    [
      "盤の下の方の移動先も、真上の段で成を同じ筋",
      { file: 5, rank: 7 },
      { column: 4, row: 5 },
    ],
    ["一段目の移動先だけ真下の段", { file: 5, rank: 1 }, { column: 4, row: 1 }],
    [
      "1筋の移動先は、不成を同じ筋",
      { file: 1, rank: 2 },
      { column: 7, row: 0 },
    ],
    ["9筋の移動先は、成を同じ筋", { file: 9, rank: 4 }, { column: 0, row: 2 }],
  ] as const;

  test.each(cases)("%s に置くこと", (_, to, expected) => {
    const placement = placeTsumeShogiPromotionPicker(to);

    expect(placement).toEqual(expected);
  });
});
