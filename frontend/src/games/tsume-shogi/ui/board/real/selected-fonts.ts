import type { TsumeShogiPieceType } from "@/games/tsume-shogi/puzzle/position";
import { tsumeShogiPieceGlyphPaths } from "@/games/tsume-shogi/ui/board/piece-glyph-paths";
import {
  type TsumeShogiCoordinateFontId,
  type TsumeShogiPieceFontId,
  tsumeShogiCoordinateFontNames,
  tsumeShogiCoordinateFontPaths,
  tsumeShogiPieceFontNames,
  tsumeShogiPieceFontPaths,
} from "@/games/tsume-shogi/ui/board/real/font-candidates";
import {
  tsumeShogiBoardStyle,
  tsumeShogiRequestedCoordinateFont,
  tsumeShogiRequestedPieceFont,
} from "@/games/tsume-shogi/ui/board-style";

/** 案R の既定の書体（比較シートで選んだ推し）。 */
const defaultPieceFont: TsumeShogiPieceFontId = "shippori-antique-b1";
const defaultCoordinateFont: TsumeShogiCoordinateFontId = "shippori-mincho";

function isPieceFontId(value: string | null): value is TsumeShogiPieceFontId {
  return value !== null && value in tsumeShogiPieceFontNames;
}

function isCoordinateFontId(
  value: string | null,
): value is TsumeShogiCoordinateFontId {
  return value !== null && value in tsumeShogiCoordinateFontNames;
}

const pieceFont = isPieceFontId(tsumeShogiRequestedPieceFont)
  ? tsumeShogiRequestedPieceFont
  : defaultPieceFont;
const coordinateFont = isCoordinateFontId(tsumeShogiRequestedCoordinateFont)
  ? tsumeShogiRequestedCoordinateFont
  : defaultCoordinateFont;

/** 駒の字形。案R では選んだ書体、それ以外では製品の字形。 */
export function getTsumeShogiPieceGlyphPath(type: TsumeShogiPieceType): string {
  if (tsumeShogiBoardStyle !== "real") return tsumeShogiPieceGlyphPaths[type];
  return (
    tsumeShogiPieceFontPaths[pieceFont][type] ?? tsumeShogiPieceGlyphPaths[type]
  );
}

/** 筋段の字形（1em = 100）。 */
export function getTsumeShogiCoordinateGlyphPath(text: string): string | null {
  return tsumeShogiCoordinateFontPaths[coordinateFont][text] ?? null;
}

export const tsumeShogiSelectedFontNames = {
  piece: tsumeShogiPieceFontNames[pieceFont],
  coordinate: tsumeShogiCoordinateFontNames[coordinateFont],
};
