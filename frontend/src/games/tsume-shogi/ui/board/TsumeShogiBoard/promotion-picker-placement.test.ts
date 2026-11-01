import { describe, expect, test } from "vitest";

import type { TsumeShogiBoardPiece } from "@/games/tsume-shogi/puzzle/position";
import { placeTsumeShogiPromotionPicker } from "@/games/tsume-shogi/ui/board/TsumeShogiBoard/promotion-picker-placement";

function defenderPiece(
  file: number,
  rank: number,
  type: "king" | "gold",
): TsumeShogiBoardPiece {
  return { square: { file, rank }, piece: { side: "defender", type } };
}

describe("placeTsumeShogiPromotionPicker", () => {
  describe("隠す駒が無い盤の上半分の移動先の場合", () => {
    const to = { file: 5, rank: 3 };

    test("升の下の中央寄せに置くこと", () => {
      const placement = placeTsumeShogiPromotionPicker(to, []);

      expect(placement).toEqual({ column: 3.5, row: 3 });
    });
  });

  describe("隠す駒が無い盤の下半分の移動先の場合", () => {
    const to = { file: 5, rank: 7 };

    test("升の上の中央寄せに置くこと", () => {
      const placement = placeTsumeShogiPromotionPicker(to, []);

      expect(placement).toEqual({ column: 3.5, row: 5 });
    });
  });

  describe("移動先の真下に玉がある場合", () => {
    const to = { file: 5, rank: 3 };
    const pieces = [defenderPiece(5, 4, "king")];

    test("玉を覆わない升の上の中央寄せに置くこと", () => {
      const placement = placeTsumeShogiPromotionPicker(to, pieces);

      expect(placement).toEqual({ column: 3.5, row: 1 });
    });
  });

  describe("移動先の上下とも駒がある盤の隅の場合", () => {
    const to = { file: 1, rank: 1 };
    const pieces = [defenderPiece(1, 2, "king"), defenderPiece(2, 2, "gold")];

    test("移動先の左に置くこと", () => {
      const placement = placeTsumeShogiPromotionPicker(to, pieces);

      expect(placement).toEqual({ column: 6, row: 0 });
    });
  });
});
