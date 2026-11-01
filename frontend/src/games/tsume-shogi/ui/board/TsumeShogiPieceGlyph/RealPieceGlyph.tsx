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
import { cn } from "@/lib/utils";

/**
 * 駒の大きさの倍率。駒種ごとの実寸の比を保ったまま、升に対する比を実物の盤駒（玉で升幅の約 0.88）へ寄せる。
 * 実寸の駒形（`piece-shape.ts`）は升を実物の目盛りの寸法で取っており、そのままでは画面で駒が小さく見える。
 */
export const REAL_PIECE_SCALE = 1.1;
/** 駒の厚み。実物の駒尻の厚み（約8mm）を、斜め上から見て面の下にのぞく分に縮めた。駒の高さに対する比。 */
const THICKNESS_RATIO = 9 / 112;
/** 影のずれ（0.1mm）。光は左上から当たる。 */
const softShadowOffset = { x: 14, y: 18 } as const;
const liftedSoftShadowOffset = { x: 36, y: 60 } as const;
const contactShadowOffset = { x: 4, y: 5 } as const;
/** 盛上げの字の縁と影のずれ（0.1mm）。3倍の画面で 1〜2 画素になる。 */
const glyphEdgeOffset = 4;
const glyphShadowOffset = { x: 9, y: 11 } as const;

/**
 * 案R: 柘植の盛上駒。面は柘植の木目、縁は約 1px の面取りで左上の辺が明るく右下の辺が暗い。
 * 手前に木口の色の厚みをのぞかせ、盤と同じ左上の光で柔らかい影と接地の濃い影を右下へ落とす。
 * 字は濡れた黒漆（成駒は朱漆）を盛り上げ、左上に明るい縁、右下に暗い縁と影を付ける。
 * 持ち上げた駒（選んだ駒）は影を長く薄くする。
 */
export function RealPieceGlyph({
  type,
  side,
  size,
  lifted = false,
}: TsumeShogiPieceGlyphProps) {
  const defIds = useTsumeShogiPieceDefIds();
  const ids = defIds?.real ?? null;
  const shape = tsumeShogiPieceShapes[type];
  const defender = side === "defender";
  const outline = defender ? shape.defenderOutline : shape.outline;
  const face = defender ? shape.defenderFace : shape.face;
  const thickness = shape.height * THICKNESS_RATIO;
  const glyphY = defender
    ? shape.height - shape.glyphCenterY
    : shape.glyphCenterY;
  const top = -shape.height / 2 - thickness / 2;
  const glyphTransform = `translate(0 ${glyphY})${defender ? " rotate(180)" : ""}`;
  const glyph = getTsumeShogiPieceGlyphPath(type);
  const promoted = promotedTypes.has(type);
  const soft = lifted ? liftedSoftShadowOffset : softShadowOffset;

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
        {ids && (
          <path
            d={outline}
            transform={`translate(${soft.x} ${thickness + soft.y})`}
            filter={`url(#${ids.softShadow})`}
            opacity={lifted ? 0.5 : 0.38}
            className={realTone.pieceSoftShadow}
          />
        )}
        {!lifted && (
          <path
            d={outline}
            transform={`translate(${contactShadowOffset.x} ${thickness + contactShadowOffset.y})`}
            className={realTone.pieceContactShadow}
          />
        )}
        <path
          d={outline}
          transform={`translate(0 ${thickness})`}
          className={realTone.pieceSide}
        />
        <path d={outline} className={realTone.pieceFace} />
        {ids && (
          <>
            <path d={outline} fill={`url(#${ids.edge})`} />
            <path d={face} fill={`url(#${ids.face})`} />
            <path d={face} fill={`url(#${ids.specular})`} />
          </>
        )}
        <path
          d={outline}
          fill="none"
          strokeWidth={2}
          strokeLinejoin="round"
          className={realTone.pieceOutline}
        />
        <path
          d={glyph}
          transform={`translate(${glyphShadowOffset.x} ${glyphShadowOffset.y}) ${glyphTransform}`}
          className={realTone.glyphShadow}
        />
        <path
          d={glyph}
          transform={`translate(${glyphEdgeOffset} ${glyphEdgeOffset}) ${glyphTransform}`}
          className={realTone.glyphDarkEdge}
        />
        <path
          d={glyph}
          transform={`translate(${-glyphEdgeOffset} ${-glyphEdgeOffset}) ${glyphTransform}`}
          className={
            promoted ? realTone.vermilionHighlight : realTone.glyphHighlight
          }
        />
        <path
          d={glyph}
          transform={glyphTransform}
          fill={ids ? `url(#${promoted ? ids.vermilion : ids.ink})` : undefined}
          // CSS の塗りは fill 属性より強いので、模様を参照できないときだけ平らな色を付ける。
          className={
            ids
              ? undefined
              : promoted
                ? realTone.vermilionFlat
                : realTone.inkFlat
          }
        />
      </g>
    </svg>
  );
}
