import { tsumeShogiPieceGlyphPaths } from "@/games/tsume-shogi/ui/board/piece-glyph-paths";
import { tsumeShogiPieceShapes } from "@/games/tsume-shogi/ui/board/piece-shape";
import {
  selectTsugeFace,
  useTsumeShogiPieceDefIds,
} from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs";
import {
  getPieceGlyphLayout,
  glyphSizeClassNames,
  promotedTypes,
  squareViewBox,
  type TsumeShogiPieceGlyphProps,
} from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/piece-glyph-frame";
import { tsumeShogiToneClassNames as tone } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

/**
 * 置いた駒の影。真上から見るので、駒の縁のすぐ右下に短く濃い接地影だけを落とす。
 * ぼかしのフィルタを駒ごとに掛けず、少しずつずらして重ねた半透明の形で柔らかく見せる（0.1mm と不透明度）。
 */
const restingShadows = [
  { x: 3, y: 4, opacity: 0.4 },
  { x: 7, y: 10, opacity: 0.16 },
] as const;
/** 持ち上げた駒の影。駒を升の約 18% 浮かせるので、元の位置の近くへぼかして落とす。 */
const liftedShadow = { x: 10, y: 62, opacity: 0.3 } as const;
/** 柘植の木目の濃さ。緻密な材で木目はほとんど見えないので、面の色にごく淡く重ねる。 */
const TSUGE_GRAIN_OPACITY = 0.1;
/** 盛上げの字の上辺の艶のずれ（0.1mm）。3倍の画面で 1 画素ほど。 */
const glyphGlossOffset = 3.5;

/**
 * 柘植の盛上駒を、盤と同じく真上から見た姿。面は均一に近い蜂蜜色で、木目（駒の識別 `grainSeed` ごとに模様の向きと位置が違い、
 * 指し手で変わらない）はごく淡く、左上から右下へのわずかな明暗とつやで材らしさを出す。側面は見えないので厚みは描かず、
 * 外形に硬い線を引かない。面取りは光を受ける左上の辺の細いハイライトだけにし、浮きは右下の短く濃い接地影で表す。
 * 字は漆の暗い茶黒（成駒は朱漆）を盛り上げ、上辺に細い艶を入れる。
 * 木目・字形は `TsumeShogiPieceDefs` の1組を参照し、その外では木目と艶を省いて描く。
 */
export function DetailedPieceGlyph({
  type,
  side,
  size,
  lifted = false,
  grainSeed,
}: TsumeShogiPieceGlyphProps) {
  const ids = useTsumeShogiPieceDefIds();
  const { outline, face, bodyTransform, glyphTransform } = getPieceGlyphLayout(
    tsumeShogiPieceShapes[type],
    side,
  );
  const promoted = promotedTypes.has(type);

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
        {lifted ? (
          <path
            d={outline}
            transform={`translate(${liftedShadow.x} ${liftedShadow.y})`}
            opacity={liftedShadow.opacity}
            filter={ids ? `url(#${ids.liftedShadowBlur})` : undefined}
            className={tone.pieceShadow}
          />
        ) : (
          restingShadows.map((shadow) => (
            <path
              key={`${shadow.x}-${shadow.y}`}
              d={outline}
              transform={`translate(${shadow.x} ${shadow.y})`}
              opacity={shadow.opacity}
              className={tone.pieceShadow}
            />
          ))
        )}
        <path d={outline} className={tone.pieceFace} />
        {ids ? (
          <>
            <path
              d={outline}
              opacity={TSUGE_GRAIN_OPACITY}
              fill={`url(#${selectTsugeFace(ids, grainSeed ?? `${side}-${type}`)})`}
            />
            <path d={outline} fill={`url(#${ids.shade})`} />
            <path
              d={face}
              fill="none"
              strokeWidth={5}
              strokeLinejoin="round"
              stroke={`url(#${ids.edge})`}
            />
            <path d={outline} fill={`url(#${ids.specular})`} />
            <use
              href={`#${ids.glyphs[type]}`}
              transform={`translate(0 ${-glyphGlossOffset}) ${glyphTransform}`}
              className={tone.glyphGloss}
            />
            <use
              href={`#${ids.glyphs[type]}`}
              transform={glyphTransform}
              fill={`url(#${promoted ? ids.vermilion : ids.ink})`}
            />
          </>
        ) : (
          <path
            d={tsumeShogiPieceGlyphPaths[type]}
            transform={glyphTransform}
            className={promoted ? tone.vermilionFlat : tone.inkFlat}
          />
        )}
      </g>
    </svg>
  );
}
