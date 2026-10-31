import type { TsumeShogiPlayedMove } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import {
  formatTsumeShogiSquare,
  tsumeShogiPieceCharacters,
  tsumeShogiUnpromotedPieceTypes,
} from "@/games/tsume-shogi/ui/piece-label";

const sideMarks = { attacker: "▲", defender: "△" } as const;

/**
 * 棋譜の書き方（例: ▲2二銀打、△1二玉、▲3二銀成、▲3二銀不成）。成れたのに成らなかった手は「不成」と書く。
 * 同じ升へ取り返す手も「同」とせず升の名前で書き、同じ升へ動ける駒が2枚ある手も「右」「上」などを付けない
 * （直前の組の手だけを盤面の移動と並べて見せるので、どの駒が動いたかは盤面で分かる）。
 */
export function formatTsumeShogiMoveNotation({
  side,
  move,
  pieceType,
  promotable,
}: TsumeShogiPlayedMove): string {
  const square = formatTsumeShogiSquare(move.to);
  if (move.kind === "drop") {
    return `${sideMarks[side]}${square}${tsumeShogiPieceCharacters[move.pieceType]}打`;
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
