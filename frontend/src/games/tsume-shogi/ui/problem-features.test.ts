import { formatTsumeShogiProblemFeatures } from "@/games/tsume-shogi/ui/problem-features";

describe("formatTsumeShogiProblemFeatures", () => {
  test("手数と、攻方の持駒の枚数と、盤上の駒の数を示すこと", () => {
    const features = formatTsumeShogiProblemFeatures({
      plies: 5,
      attackerHandPieceCount: 2,
      boardPieceCount: 7,
    });

    expect(features).toEqual([
      { label: "手数", value: "5手" },
      { label: "持駒", value: "2枚" },
      { label: "盤上の駒", value: "7枚" },
    ]);
  });
});
