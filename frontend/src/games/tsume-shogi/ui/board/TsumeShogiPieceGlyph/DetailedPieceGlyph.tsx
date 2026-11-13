import { tsumeShogiPieceGlyphPaths } from "@/games/tsume-shogi/ui/board/piece-glyph-paths";
import {
  TSUME_SHOGI_PIECE_SIDE_DEPTH,
  tsumeShogiPieceShapes,
} from "@/games/tsume-shogi/ui/board/piece-shape";
import {
  selectTsugeFace,
  useTsumeShogiPieceDefIds,
} from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs";
import {
  centeredSquareViewBox,
  getPieceGlyphLayout,
  glyphSizeClassNames,
  pieceMotionAttribute,
  promotedTypes,
  type TsumeShogiPieceGlyphProps,
} from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/piece-glyph-frame";
import { tsumeShogiToneClassNames as tone } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

/**
 * 置いた駒の影。駒の厚み（約 8mm）の分だけ右下へ伸ばし、縁のすぐ下は濃く、先へ向かって淡くする。
 * 影が短いと駒が紙の札に見える。ぼかしのフィルタを駒ごとに掛けず、少しずつずらして重ねた半透明の形で
 * 柔らかく見せる（0.1mm と不透明度）。
 */
const restingShadows = [
  { x: 3, y: 3, opacity: 0.34 },
  { x: 7, y: 7, opacity: 0.2 },
  { x: 12, y: 12, opacity: 0.11 },
  { x: 18, y: 17, opacity: 0.06 },
] as const;
/**
 * 持ち上げた駒の姿。見る側へ近づくので、ひと回り大きくし、指の下から見えるよう上へ少しずらす（升の高さの約 6%）。
 * 大きくせずに上へずらすだけだと、厚みの無い札が盤の上を滑って見える。真上の升の駒に重ならない量に抑える。
 * 駒を囲む HTML の要素ではなく、絵の中で動かす（理由は `pieceMotionAttribute`）。
 */
const liftedPose = "translate(0px, -23px) scale(1.08)";
const restingPose = "translate(0px, 0px) scale(1)";
/** 持ち上げる・置く動きと、影の入れ替わりを同じ長さでそろえる。 */
const liftTransition =
  "duration-(--duration-normal) ease-(--ease-standard) motion-reduce:transition-none";
/**
 * 持ち上げた駒の影。盤から離れた分だけ右下へ遠く落ちる広く淡い影（`ambient`）と、駒の厚みを残す近く濃い影（`core`）を
 * 重ねる。淡い影だけにすると、厚みの無い札が浮いて見える。
 */
const liftedShadows = [
  { kind: "ambient", x: 20, y: 46, opacity: 0.26 },
  { kind: "core", x: 9, y: 20, opacity: 0.3 },
] as const;
/**
 * 彫りの深さの見え方（0.1mm、画面の右下向き）。溝の左上の壁の陰の幅と、溝の右下の縁が光を受ける幅。
 * 3倍の画面で 1 画素ほど。
 */
const grooveWallShade = { x: 2.8, y: 3.6 } as const;
const grooveRimLight = { x: 2.2, y: 2.8 } as const;
const GROOVE_RIM_LIGHT_OPACITY = 0.6;
/**
 * 字の線に足す太さ（0.1mm）。明朝の横線は細く、盤の大きさでは途切れて見えるので、溝と縁を外へ同じ幅だけ広げる。
 */
const GLYPH_STROKE_GAIN = 2;

/**
 * 柘植の彫駒を、盤と同じく手前へわずかに傾けた向きから見た姿。面は淡い金色の柘植で、柾目と虎斑（駒の識別 `grainSeed` ごとに
 * 模様の向きと位置が違い、指し手で変わらない）はごく淡く、左上から右下へのわずかな明暗とつやで材らしさを出す。
 * 外形に硬い線を引かない。厚みは、手前に見える側面と、面取りの斜面の明暗（左上の辺が光を受け、右下の辺が陰になる）と、
 * 右下へ伸びる影で表す。字は太い明朝の一字を、彫った溝に漆（成駒は朱漆）を入れた姿で描き、溝の左上の壁を陰に、右下の縁を明るくして彫りの深さを、
 * 溝の底の漆の上を明るくして漆の艶を出す。
 * 木目・字形は `TsumeShogiPieceDefs` の1組を参照し、その外では木目・彫り・艶を省いて描く。
 */
export function DetailedPieceGlyph({
  type,
  side,
  size,
  lifted = false,
  grainSeed,
}: TsumeShogiPieceGlyphProps) {
  const ids = useTsumeShogiPieceDefIds();
  const { outline, face, solid, bodyTransform, glyphTransform } =
    getPieceGlyphLayout(tsumeShogiPieceShapes[type], side);
  const promoted = promotedTypes.has(type);
  // 側面の分だけ駒が下へ伸びるので、面と側面を合わせた姿を升の中央に置く。
  const centering = `translate(0 ${-TSUME_SHOGI_PIECE_SIDE_DEPTH[side] / 2})`;
  // 字は玉方で 180° 回るので、画面の右下へのずれは字の座標で逆向きになる。
  const towardLowerRight = side === "defender" ? -1 : 1;

  return (
    <svg
      viewBox={centeredSquareViewBox}
      aria-hidden="true"
      className={cn(
        "pointer-events-none shrink-0 overflow-visible",
        glyphSizeClassNames[size],
      )}
    >
      <g {...{ [pieceMotionAttribute]: "" }}>
        <g
          className={cn("transition-transform", liftTransition)}
          style={{ transform: lifted ? liftedPose : restingPose }}
        >
          <g transform={`${bodyTransform} ${centering}`}>
            <g
              className={cn("transition-opacity", liftTransition)}
              opacity={lifted ? 0 : 1}
            >
              {restingShadows.map((shadow) => (
                <path
                  key={`${shadow.x}-${shadow.y}`}
                  d={solid}
                  transform={`translate(${shadow.x} ${shadow.y})`}
                  opacity={shadow.opacity}
                  className={tone.pieceShadow}
                />
              ))}
            </g>
            <g
              className={cn("transition-opacity", liftTransition)}
              opacity={lifted ? 1 : 0}
            >
              {liftedShadows.map((shadow) => (
                <path
                  key={shadow.kind}
                  d={solid}
                  transform={`translate(${shadow.x} ${shadow.y})`}
                  opacity={shadow.opacity}
                  filter={
                    ids
                      ? `url(#${ids.liftedShadowBlurs[shadow.kind]})`
                      : undefined
                  }
                  className={tone.pieceShadow}
                />
              ))}
            </g>
            <path
              d={solid}
              strokeWidth={2}
              strokeLinejoin="round"
              className={cn(tone.pieceSide, tone.pieceSideEdge)}
            />
            {ids && <path d={solid} fill={`url(#${ids.side})`} />}
            <path d={outline} className={tone.pieceFace} />
            {ids ? (
              <>
                <path
                  d={outline}
                  fill={`url(#${selectTsugeFace(ids, grainSeed ?? `${side}-${type}`)})`}
                />
                <path d={outline} fill={`url(#${ids.shade})`} />
                <path
                  d={`${outline}${face}`}
                  fillRule="evenodd"
                  fill={`url(#${ids.chamfer})`}
                />
                <path d={outline} fill={`url(#${ids.specular})`} />
                <g transform={glyphTransform}>
                  <use
                    href={`#${ids.glyphs[type]}`}
                    transform={`translate(${towardLowerRight * grooveRimLight.x} ${towardLowerRight * grooveRimLight.y})`}
                    strokeWidth={GLYPH_STROKE_GAIN}
                    strokeLinejoin="round"
                    opacity={GROOVE_RIM_LIGHT_OPACITY}
                    className={tone.glyphRim}
                  />
                  <use
                    href={`#${ids.glyphs[type]}`}
                    strokeWidth={GLYPH_STROKE_GAIN}
                    strokeLinejoin="round"
                    className={promoted ? tone.vermilionGroove : tone.inkGroove}
                  />
                  <g clipPath={`url(#${ids.glyphClips[type]})`}>
                    <use
                      href={`#${ids.glyphs[type]}`}
                      transform={`translate(${towardLowerRight * grooveWallShade.x} ${towardLowerRight * grooveWallShade.y})`}
                      fill={`url(#${promoted ? ids.vermilion : ids.ink})`}
                    />
                  </g>
                </g>
              </>
            ) : (
              <path
                d={tsumeShogiPieceGlyphPaths[type]}
                transform={glyphTransform}
                className={promoted ? tone.vermilionFlat : tone.inkFlat}
              />
            )}
          </g>
        </g>
      </g>
    </svg>
  );
}
