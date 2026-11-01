import { tsumeShogiPieceGlyphPaths } from "@/games/tsume-shogi/ui/board/piece-glyph-paths";
import { tsumeShogiPieceShapes } from "@/games/tsume-shogi/ui/board/piece-shape";
import { useTsumeShogiPieceDefIds } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs";
import {
  glyphSizeClassNames,
  promotedTypes,
  squareViewBox,
  type TsumeShogiPieceGlyphProps,
} from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/piece-glyph-frame";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

/** 駒の厚みと、盤に落とす影のずれ。駒の高さに対する比。 */
const THICKNESS_RATIO = 4 / 112;
const SHADOW_OFFSET_RATIO = 6.5 / 112;
const OUTLINE_STROKE_WIDTH = 2.7;

/**
 * 柘植の駒。駒種ごとに実物の大きさの五角形に1文字を書き、面の下に側面をのぞかせて厚みを見せ、
 * 縁を面取りして上の縁を明るくし、面に柾目を淡く重ねる。
 */
export function CurrentPieceGlyph({
  type,
  side,
  size,
}: TsumeShogiPieceGlyphProps) {
  const defIds = useTsumeShogiPieceDefIds();
  const shape = tsumeShogiPieceShapes[type];
  const defender = side === "defender";
  const outline = defender ? shape.defenderOutline : shape.outline;
  const face = defender ? shape.defenderFace : shape.face;
  const thickness = shape.height * THICKNESS_RATIO;
  const shadowOffset = shape.height * SHADOW_OFFSET_RATIO;
  const glyphY = defender
    ? shape.height - shape.glyphCenterY
    : shape.glyphCenterY;
  // 面と側面を合わせた塊が升の中央に来るよう、厚みの半分だけ上へ置く。
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
      <g transform={`translate(0 ${top})`}>
        <path
          d={outline}
          transform={`translate(0 ${shadowOffset})`}
          className={tsumeShogiToneClassNames.pieceShadow}
        />
        <path
          d={outline}
          transform={`translate(0 ${thickness})`}
          strokeWidth={OUTLINE_STROKE_WIDTH}
          strokeLinejoin="round"
          className={tsumeShogiToneClassNames.pieceSide}
        />
        {defIds ? (
          <>
            <path
              d={outline}
              fill={`url(#${defender ? defIds.defenderBevel : defIds.bevel})`}
            />
            <path
              d={face}
              fill={`url(#${defender ? defIds.defenderFace : defIds.face})`}
            />
            <path d={outline} fill={`url(#${defIds.grain})`} />
          </>
        ) : (
          <path d={outline} className={tsumeShogiToneClassNames.pieceFill} />
        )}
        <path
          d={outline}
          fill="none"
          strokeWidth={OUTLINE_STROKE_WIDTH}
          strokeLinejoin="round"
          className={tsumeShogiToneClassNames.pieceStroke}
        />
        <path
          d={tsumeShogiPieceGlyphPaths[type]}
          transform={`translate(0 ${glyphY})${defender ? " rotate(180)" : ""}`}
          className={
            promotedTypes.has(type)
              ? tsumeShogiToneClassNames.promotedText
              : tsumeShogiToneClassNames.pieceText
          }
        />
      </g>
    </svg>
  );
}
