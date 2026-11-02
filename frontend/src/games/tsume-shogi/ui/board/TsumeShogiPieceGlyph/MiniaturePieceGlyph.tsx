import { tsumeShogiPieceGlyphPaths } from "@/games/tsume-shogi/ui/board/piece-glyph-paths";
import { tsumeShogiPieceShapes } from "@/games/tsume-shogi/ui/board/piece-shape";
import {
  getPieceGlyphLayout,
  glyphSizeClassNames,
  promotedTypes,
  squareViewBox,
  type TsumeShogiPieceGlyphProps,
} from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/piece-glyph-frame";
import { tsumeShogiToneClassNames as tone } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

const groundShadowOffset = { x: 3, y: 5 } as const;

/**
 * 遊び方の小さな図の駒。盤の駒と同じ真上からの姿で、柘植の色・短い接地の影・書体をそろえ、
 * 小さくて見分けられない木目・明暗・面取り・つや・艶は省き、細い輪郭で地から分ける。共有の塗りや字形を参照しないので、
 * `TsumeShogiPieceDefs` の外でも描ける。
 */
export function MiniaturePieceGlyph({
  type,
  side,
  size,
}: TsumeShogiPieceGlyphProps) {
  const { outline, bodyTransform, glyphTransform } = getPieceGlyphLayout(
    tsumeShogiPieceShapes[type],
    side,
  );

  return (
    <svg
      viewBox={squareViewBox}
      aria-hidden="true"
      className={cn(
        "pointer-events-none shrink-0 overflow-visible",
        glyphSizeClassNames[size],
      )}
    >
      <g transform={bodyTransform}>
        <path
          d={outline}
          transform={`translate(${groundShadowOffset.x} ${groundShadowOffset.y})`}
          opacity={0.4}
          className={tone.pieceShadow}
        />
        <path
          d={outline}
          strokeWidth={4}
          strokeLinejoin="round"
          className={cn(tone.pieceFace, tone.miniaturePieceOutline)}
        />
        <path
          d={tsumeShogiPieceGlyphPaths[type]}
          transform={glyphTransform}
          className={
            promotedTypes.has(type) ? tone.vermilionFlat : tone.inkFlat
          }
        />
      </g>
    </svg>
  );
}
