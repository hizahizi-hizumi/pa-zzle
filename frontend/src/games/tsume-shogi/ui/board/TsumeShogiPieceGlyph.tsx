import type {
  TsumeShogiPieceType,
  TsumeShogiSide,
} from "@/games/tsume-shogi/puzzle/position";
import { tsumeShogiPieceGlyphPaths } from "@/games/tsume-shogi/ui/board/piece-glyph-paths";
import {
  TSUME_SHOGI_SQUARE_HEIGHT,
  TSUME_SHOGI_SQUARE_WIDTH,
  tsumeShogiPieceShapes,
} from "@/games/tsume-shogi/ui/board/piece-shape";
import { useTsumeShogiPieceDefIds } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

const promotedTypes = new Set<TsumeShogiPieceType>([
  "dragon",
  "horse",
  "promSilver",
  "promKnight",
  "promLance",
  "promPawn",
]);

/** 駒を描く範囲は盤の1升。中心を原点にし、升に対する駒の大きさを実物のままにする。 */
const squareViewBox = `${-TSUME_SHOGI_SQUARE_WIDTH / 2} ${-TSUME_SHOGI_SQUARE_HEIGHT / 2} ${TSUME_SHOGI_SQUARE_WIDTH} ${TSUME_SHOGI_SQUARE_HEIGHT}`;

/** 駒の厚みと、盤に落とす影のずれ。駒の高さに対する比。 */
const THICKNESS_RATIO = 4 / 112;
const SHADOW_OFFSET_RATIO = 6.5 / 112;
const OUTLINE_STROKE_WIDTH = 2.7;

/**
 * 駒を置く升の大きさ。`board` は盤の升いっぱい、`choice` は下に「成」「不成」の札を置く成・不成の選択肢、
 * `hand` は持駒の駒台、`figure` は遊び方の図。どれも升の縦横比のまま、駒の大きさは升に対して実物の比率になる。
 */
const glyphSizeClassNames = {
  board: "size-full",
  choice: "mb-2 aspect-[352/386] h-[88%]",
  hand: "aspect-[352/386] h-10",
  figure: "aspect-[352/386] h-7",
} as const;

type TsumeShogiPieceGlyphProps = {
  type: TsumeShogiPieceType;
  side: TsumeShogiSide;
  size: keyof typeof glyphSizeClassNames;
};

/**
 * 柘植の駒。駒種ごとに実物の大きさの五角形に1文字を書き、面の下に側面をのぞかせて厚みを見せ、
 * 縁を面取りして上の縁を明るくし、面に柾目を淡く重ねる。
 * 玉方の駒は将棋盤の慣例どおり 180° 回して、向きで攻方と見分ける。回しても側面・影・光は画面の下・上に置く。
 * 第三者の駒画像を使わず、図形と字形の輪郭だけで描く。
 */
export function TsumeShogiPieceGlyph({
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
