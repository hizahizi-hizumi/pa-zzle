import { tsumeShogiPieceShapes } from "@/games/tsume-shogi/ui/board/piece-shape";
import { tsumeShogiRealToneClassNames as realTone } from "@/games/tsume-shogi/ui/board/real/real-tone";
import { getTsumeShogiPieceGlyphPath } from "@/games/tsume-shogi/ui/board/real/selected-fonts";
import {
  glyphSizeClassNames,
  promotedTypes,
  squareViewBox,
  type TsumeShogiPieceGlyphProps,
} from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/piece-glyph-frame";
import { REAL_PIECE_SCALE } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/RealPieceGlyph";
import { cn } from "@/lib/utils";

/** 小さな図の駒の厚み。盤の駒と同じ比にする。 */
const THICKNESS_RATIO = 9 / 112;
const contactShadowOffset = { x: 6, y: 8 } as const;

/**
 * 案R の小さな図（遊び方・難易度のプレビュー）の駒。盤の駒と同じ柘植の色・木口の厚み・接地の影・書体で、
 * 見分けられない木目・面取り・つや・盛上げの縁は省く。
 */
export function RealMiniaturePieceGlyph({
  type,
  side,
  size,
}: TsumeShogiPieceGlyphProps) {
  const shape = tsumeShogiPieceShapes[type];
  const defender = side === "defender";
  const outline = defender ? shape.defenderOutline : shape.outline;
  const thickness = shape.height * THICKNESS_RATIO;
  const glyphY = defender
    ? shape.height - shape.glyphCenterY
    : shape.glyphCenterY;
  const top = -shape.height / 2 - thickness / 2;

  return (
    <svg
      viewBox={squareViewBox}
      aria-hidden="true"
      className={cn(
        "pointer-events-none shrink-0 overflow-visible",
        glyphSizeClassNames[size],
      )}
    >
      <g transform={`scale(${REAL_PIECE_SCALE}) translate(0 ${top})`}>
        <path
          d={outline}
          transform={`translate(${contactShadowOffset.x} ${thickness + contactShadowOffset.y})`}
          className={realTone.pieceContactShadow}
        />
        <path
          d={outline}
          transform={`translate(0 ${thickness})`}
          className={realTone.pieceSide}
        />
        <path
          d={outline}
          strokeWidth={4}
          strokeLinejoin="round"
          className={cn(realTone.pieceFace, realTone.pieceOutline)}
        />
        <path
          d={getTsumeShogiPieceGlyphPath(type)}
          transform={`translate(0 ${glyphY})${defender ? " rotate(180)" : ""}`}
          className={
            promotedTypes.has(type) ? realTone.vermilionFlat : realTone.inkFlat
          }
        />
      </g>
    </svg>
  );
}
