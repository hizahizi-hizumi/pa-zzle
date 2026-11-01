import { describe, expect, test } from "vitest";

import type {
  TsumeShogiBoardPiece,
  TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import {
  placeTsumeShogiPromotionPicker,
  type TsumeShogiPromotionPickerPlacement,
} from "@/games/tsume-shogi/ui/board/TsumeShogiBoard/promotion-picker-placement";

function defenderPiece(
  file: number,
  rank: number,
  type: "king" | "gold",
): TsumeShogiBoardPiece {
  return { square: { file, rank }, piece: { side: "defender", type } };
}

function covers(
  placement: TsumeShogiPromotionPickerPlacement,
  square: TsumeShogiSquare,
): boolean {
  const column = 9 - square.file;
  return (
    placement.row === square.rank - 1 &&
    column >= Math.floor(placement.column) &&
    column < Math.ceil(placement.column + 2)
  );
}

describe("placeTsumeShogiPromotionPicker", () => {
  describe("隠す駒が無い盤の上半分の移動先の場合", () => {
    const to = { file: 5, rank: 3 };

    test("升の下の中央寄せに置くこと", () => {
      const placement = placeTsumeShogiPromotionPicker(to, []);

      expect(placement).toEqual({ column: 3.5, row: 3 });
    });
  });

  describe("移動先の真下に玉がある場合", () => {
    const to = { file: 5, rank: 3 };
    const king = defenderPiece(5, 4, "king");

    test("玉を覆わない位置に置くこと", () => {
      const placement = placeTsumeShogiPromotionPicker(to, [king]);

      expect(covers(placement, king.square)).toBe(false);
    });
  });

  describe("盤の隅の移動先の場合", () => {
    const to = { file: 1, rank: 1 };
    const pieces = [defenderPiece(1, 2, "king"), defenderPiece(2, 2, "gold")];

    test("移動先の升を覆わないこと", () => {
      const placement = placeTsumeShogiPromotionPicker(to, pieces);

      expect(covers(placement, to)).toBe(false);
    });
  });
});
