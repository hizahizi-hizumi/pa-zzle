import { tsumeShogiPieceShapes } from "@/games/tsume-shogi/ui/board/piece-shape";
import { tsumeShogiRealToneClassNames as realTone } from "@/games/tsume-shogi/ui/board/real/real-tone";
import { getTsumeShogiPieceGlyphPath } from "@/games/tsume-shogi/ui/board/real/selected-fonts";
import { useTsumeShogiPieceDefIds } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs";
import {
  glyphSizeClassNames,
  promotedTypes,
  squareViewBox,
  type TsumeShogiPieceGlyphProps,
} from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/piece-glyph-frame";
import {
  REAL_PIECE_SCALE,
  REAL_THICKNESS_RATIO,
} from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/RealPieceGlyph";
import { cn } from "@/lib/utils";

const groundShadowOffset = { x: 6, y: 8 } as const;

/**
 * 案R の小さな図（遊び方・難易度のプレビュー）の駒。盤の駒と同じ柘植の色・厚み・接地の影・書体で、
 * 小さくて見分けられない木目・面取り・つや・艶は省き、細い輪郭で地から分ける。
 */
export function RealMiniaturePieceGlyph({
  type,
  side,
  size,
}: TsumeShogiPieceGlyphProps) {
  const ids = useTsumeShogiPieceDefIds()?.real ?? null;
  const shape = tsumeShogiPieceShapes[type];
  const defender = side === "defender";
  const outline = defender ? shape.defenderOutline : shape.outline;
  const thickness = shape.height * REAL_THICKNESS_RATIO;
  const glyphY = defender
    ? shape.height - shape.glyphCenterY
    : shape.glyphCenterY;
  const top = -shape.height / 2 - thickness / 2;
  const glyphTransform = `translate(0 ${glyphY})${defender ? " rotate(180)" : ""}`;
  const glyphClassName = promotedTypes.has(type)
    ? realTone.vermilionFlat
    : realTone.inkFlat;

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
          transform={`translate(${groundShadowOffset.x} ${thickness + groundShadowOffset.y})`}
          opacity={0.35}
          className={realTone.pieceShadow}
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
          className={cn(realTone.pieceFace, realTone.miniaturePieceOutline)}
        />
        {ids ? (
          <use
            href={`#${ids.glyphs[type]}`}
            transform={glyphTransform}
            className={glyphClassName}
          />
        ) : (
          <path
            d={getTsumeShogiPieceGlyphPath(type)}
            transform={glyphTransform}
            className={glyphClassName}
          />
        )}
      </g>
    </svg>
  );
}
