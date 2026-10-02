import type { TsumeShogiPlayedMove } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import {
  formatTsumeShogiSquare,
  tsumeShogiPieceCharacters,
  tsumeShogiUnpromotedPieceTypes,
} from "@/games/tsume-shogi/ui/piece-label";

const sideMarks = { attacker: "▲", defender: "△" } as const;

/** 棋譜の書き方（例: ▲2二銀打、△1二玉、▲3二銀成）。同じ升へ取り返す手も升の名前で書く。 */
export function formatTsumeShogiMoveNotation({
  side,
  move,
  pieceType,
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
  return `${sideMarks[side]}${square}${tsumeShogiPieceCharacters[pieceType]}`;
}
