import { tsumeShogiPieceGlyphPaths } from "@/games/tsume-shogi/ui/board/piece-glyph-paths";
import { tsumeShogiPieceShapes } from "@/games/tsume-shogi/ui/board/piece-shape";
import {
  glyphSizeClassNames,
  glyphTextClassName,
  squareViewBox,
  type TsumeShogiPieceGlyphProps,
} from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/piece-glyph-frame";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

/** 案S: 平らな五角形に細い輪郭と字だけ。厚み・影・面取り・木目を描かない。 */
export function QuietPieceGlyph({
  type,
  side,
  size,
}: TsumeShogiPieceGlyphProps) {
  const shape = tsumeShogiPieceShapes[type];
  const defender = side === "defender";
  const glyphY = defender
    ? shape.height - shape.glyphCenterY
    : shape.glyphCenterY;
  return (
    <svg
      viewBox={squareViewBox}
      aria-hidden="true"
      className={cn(
        "pointer-events-none shrink-0 overflow-visible",
        glyphSizeClassNames[size],
      )}
    >
      <g transform={`translate(0 ${-shape.height / 2})`}>
        <path
          d={defender ? shape.defenderOutline : shape.outline}
          strokeWidth={1}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className={cn(
            tsumeShogiToneClassNames.pieceFill,
            tsumeShogiToneClassNames.pieceStroke,
          )}
        />
        <path
          d={tsumeShogiPieceGlyphPaths[type]}
          transform={`translate(0 ${glyphY})${defender ? " rotate(180)" : ""}`}
          className={glyphTextClassName(type)}
        />
      </g>
    </svg>
  );
}
