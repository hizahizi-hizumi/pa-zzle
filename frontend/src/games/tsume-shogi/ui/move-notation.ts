import type { TsumeShogiPlayedMove } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import {
  isSameTsumeShogiSquare,
  type TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import {
  formatTsumeShogiSquare,
  tsumeShogiPieceCharacters,
  tsumeShogiUnpromotedPieceTypes,
} from "@/games/tsume-shogi/ui/piece-label";

const sideMarks = { attacker: "▲", defender: "△" } as const;

/**
 * 棋譜の書き方（例: ▲2二銀、△1二玉、▲3二銀成、▲3二銀不成、△同玉）。成れたのに成らなかった手は「不成」と書く。
 * 持駒を打った手は、同じ升へ盤上の同じ種類の駒も動けたとき（`dropAmbiguous`）だけ「打」を付ける（例: ▲2二銀打）。
 * 直前の手（`previousMoveTo`）と同じ升へ指した手は、升の名前の代わりに「同」と書く。
 * 同じ升へ動ける駒が2枚ある手に「右」「上」などは付けない（直前の組の手だけを盤面の移動と並べて見せるので、どの駒が動いたかは盤面で分かる）。
 */
export function formatTsumeShogiMoveNotation(
  { side, move, pieceType, promotable, dropAmbiguous }: TsumeShogiPlayedMove,
  previousMoveTo: TsumeShogiSquare | null = null,
): string {
  const square =
    previousMoveTo && isSameTsumeShogiSquare(previousMoveTo, move.to)
      ? "同"
      : formatTsumeShogiSquare(move.to);
  if (move.kind === "drop") {
    return `${sideMarks[side]}${square}${tsumeShogiPieceCharacters[move.pieceType]}${dropAmbiguous ? "打" : ""}`;
  }
  if (move.promote && pieceType in tsumeShogiUnpromotedPieceTypes) {
    const unpromoted =
      tsumeShogiUnpromotedPieceTypes[
        pieceType as keyof typeof tsumeShogiUnpromotedPieceTypes
      ];
    return `${sideMarks[side]}${square}${tsumeShogiPieceCharacters[unpromoted]}成`;
  }
  const declinedPromotion = promotable && !move.promote ? "不成" : "";
  return `${sideMarks[side]}${square}${tsumeShogiPieceCharacters[pieceType]}${declinedPromotion}`;
}
