import { useId } from "react";

import { tsumeShogiPieceShapes } from "@/games/tsume-shogi/ui/board/piece-shape";
import { tsumeShogiRealToneClassNames as realTone } from "@/games/tsume-shogi/ui/board/real/real-tone";
import { getTsumeShogiPieceGlyphPath } from "@/games/tsume-shogi/ui/board/real/selected-fonts";
import { useTsumeShogiPieceDefIds } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs";
import {
  TSUGE_TILE_HEIGHT,
  TSUGE_TILE_WIDTH,
} from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs/RealPieceDefs";
import {
  glyphSizeClassNames,
  promotedTypes,
  squareViewBox,
  type TsumeShogiPieceGlyphProps,
} from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/piece-glyph-frame";
import { cn } from "@/lib/utils";

/**
 * 駒の大きさの倍率。駒種ごとの実寸の比を保ったまま、升に対する比を実物の盤駒（玉で升幅の約 0.88）へ寄せる。
 * 実寸の駒形（`piece-shape.ts`）は升を実物の目盛りの寸法で取っており、そのままでは画面で駒が小さく見える。
 */
export const REAL_PIECE_SCALE = 1.1;
/** 駒の厚み。実物の駒尻の厚み（約8mm）を、斜め上から見て面の下にのぞく分に縮めた。駒の高さに対する比。 */
export const REAL_THICKNESS_RATIO = 9 / 112;
/**
 * 駒の影。ぼかしのフィルタを駒ごとに掛けず、少しずつずらして重ねた半透明の形で柔らかく見せる（0.1mm と不透明度）。
 * 持ち上げた駒は升の約 15% 浮くので、影を遠く薄く落とす。
 */
const restingShadows = [
  { x: 3, y: 4, opacity: 0.28 },
  { x: 8, y: 11, opacity: 0.12 },
  { x: 14, y: 19, opacity: 0.06 },
] as const;
const liftedShadows = [
  { x: 16, y: 58, opacity: 0.12 },
  { x: 26, y: 74, opacity: 0.08 },
  { x: 36, y: 90, opacity: 0.05 },
] as const;
/** 盛上げの字の上辺の艶のずれ（0.1mm）。3倍の画面で 1 画素ほど。 */
const glyphGlossOffset = 3.5;

/** 駒ごとに柘植の木目の位置をずらす量（0.1mm）。駒の id から決め、描き直しても変わらない。 */
function grainOffset(seed: string): { x: number; y: number } {
  let hash = 2166136261;
  for (const character of seed) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  const unsigned = hash >>> 0;
  return {
    x: ((unsigned % 997) / 997) * (TSUGE_TILE_WIDTH / 2),
    y: (((unsigned >>> 10) % 991) / 991) * (TSUGE_TILE_HEIGHT / 2),
  };
}

/**
 * 案R: 柘植の盛上駒。面は柘植の細かく不規則な木目（駒ごとに模様の位置が違う）で、外形に硬い線を引かない。
 * 面取りは縁の光と陰のにじみで表し、左上が明るく右下が暗い。手前に同じ色相で暗い厚みをのぞかせ、左上の光で右下へ影を落とす。
 * 字は漆の暗い茶黒（成駒は朱漆）を盛り上げ、上辺に細い艶を入れる。
 */
export function RealPieceGlyph({
  type,
  side,
  size,
  lifted = false,
}: TsumeShogiPieceGlyphProps) {
  const defIds = useTsumeShogiPieceDefIds();
  const ids = defIds?.real ?? null;
  const offset = grainOffset(useId());
  const shape = tsumeShogiPieceShapes[type];
  const defender = side === "defender";
  const outline = defender ? shape.defenderOutline : shape.outline;
  const face = defender ? shape.defenderFace : shape.face;
  const thickness = shape.height * REAL_THICKNESS_RATIO;
  const glyphY = defender
    ? shape.height - shape.glyphCenterY
    : shape.glyphCenterY;
  const top = -shape.height / 2 - thickness / 2;
  const glyphTransform = `translate(0 ${glyphY})${defender ? " rotate(180)" : ""}`;
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
      <g transform={`scale(${REAL_PIECE_SCALE}) translate(0 ${top})`}>
        {(lifted ? liftedShadows : restingShadows).map((shadow) => (
          <path
            key={`${shadow.x}-${shadow.y}`}
            d={outline}
            transform={`translate(${shadow.x} ${thickness + shadow.y})`}
            opacity={shadow.opacity}
            className={realTone.pieceShadow}
          />
        ))}
        <path
          d={outline}
          transform={`translate(0 ${thickness})`}
          className={realTone.pieceSide}
        />
        <path d={outline} className={realTone.pieceFace} />
        {ids && (
          <>
            {/* 模様は参照した要素の座標で敷かれるので、座標をずらして描き、同じ量だけ戻して置く。 */}
            <g transform={`translate(${offset.x} ${offset.y})`}>
              <path
                d={outline}
                transform={`translate(${-offset.x} ${-offset.y})`}
                fill={`url(#${ids.face})`}
              />
            </g>
            <path
              d={face}
              fill="none"
              strokeWidth={16}
              strokeLinejoin="round"
              opacity={0.45}
              stroke={`url(#${ids.edge})`}
            />
            <path
              d={face}
              fill="none"
              strokeWidth={6}
              strokeLinejoin="round"
              opacity={0.6}
              stroke={`url(#${ids.edge})`}
            />
            <path d={outline} fill={`url(#${ids.specular})`} />
          </>
        )}
        {ids ? (
          <>
            <use
              href={`#${ids.glyphs[type]}`}
              transform={`translate(0 ${-glyphGlossOffset}) ${glyphTransform}`}
              className={realTone.glyphGloss}
            />
            <use
              href={`#${ids.glyphs[type]}`}
              transform={glyphTransform}
              fill={`url(#${promoted ? ids.vermilion : ids.ink})`}
            />
          </>
        ) : (
          <path
            d={getTsumeShogiPieceGlyphPath(type)}
            transform={glyphTransform}
            className={promoted ? realTone.vermilionFlat : realTone.inkFlat}
          />
        )}
      </g>
    </svg>
  );
}
