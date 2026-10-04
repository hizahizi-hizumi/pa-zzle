import { useId } from "react";
import type {
  TsumeShogiPieceType,
  TsumeShogiSide,
} from "@/games/tsume-shogi/puzzle/position";
import { tsumeShogiPieceGlyphPaths } from "@/games/tsume-shogi/ui/board/piece-glyph-paths";
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

/** 駒の輪郭。肩を高さの約25%に置き、肩の幅を底の約83%にした、将棋の駒の比率の五角形。 */
const pieceOutline = "M50 2L89 29L97 110L3 110L11 29Z";

/**
 * 駒の格ごとの大きさ。本物の駒と同じく玉が最も大きく、歩が最も小さい。成った駒は元の駒の大きさのまま。
 */
const pieceScales = {
  king: 1,
  rook: 0.97,
  bishop: 0.97,
  dragon: 0.97,
  horse: 0.97,
  gold: 0.95,
  silver: 0.95,
  promSilver: 0.95,
  knight: 0.93,
  promKnight: 0.93,
  lance: 0.92,
  promLance: 0.92,
  pawn: 0.9,
  promPawn: 0.9,
} as const satisfies Record<TsumeShogiPieceType, number>;

/**
 * 駒の大きさ。`board` は升いっぱい、`choice` は下に「成」「不成」の札を置く成・不成の選択肢、
 * `hand` は持駒の欄、`figure` は遊び方の図。
 */
const glyphSizeClassNames = {
  board: "h-[94%] w-[92%]",
  choice: "mb-2.5 h-[72%] w-[72%]",
  hand: "h-9 w-8",
  figure: "h-6 w-5",
} as const;

type TsumeShogiPieceGlyphProps = {
  type: TsumeShogiPieceType;
  side: TsumeShogiSide;
  size: keyof typeof glyphSizeClassNames;
};

/**
 * 五角形の駒に筆文字の1文字を書いた駒。玉方の駒は将棋盤の慣例どおり 180° 回して、向きで攻方と見分ける。
 * 第三者の駒画像を使わず、図形と字形の輪郭だけで描く。
 */
export function TsumeShogiPieceGlyph({
  type,
  side,
  size,
}: TsumeShogiPieceGlyphProps) {
  const faceGradientId = useId();
  const scale = pieceScales[type];
  return (
    <svg
      viewBox="0 0 100 112"
      aria-hidden="true"
      className={cn(
        "pointer-events-none overflow-visible",
        glyphSizeClassNames[size],
        side === "defender" && "rotate-180",
      )}
    >
      <defs>
        <linearGradient id={faceGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className={tsumeShogiToneClassNames.pieceFaceTop} />
          <stop
            offset="1"
            className={tsumeShogiToneClassNames.pieceFaceBottom}
          />
        </linearGradient>
      </defs>
      <g transform={`translate(50 110) scale(${scale}) translate(-50 -110)`}>
        <path
          d={pieceOutline}
          transform={side === "defender" ? "translate(0 -4)" : "translate(0 4)"}
          className={tsumeShogiToneClassNames.pieceShadow}
        />
        <path
          d={pieceOutline}
          fill={`url(#${faceGradientId})`}
          strokeWidth={2}
          strokeLinejoin="round"
          className={tsumeShogiToneClassNames.pieceStroke}
        />
        {/* 筆文字は細い画が小さい駒でかすれるので、字と同じ色の線を重ねて太らせる。 */}
        <path
          d={tsumeShogiPieceGlyphPaths[type]}
          strokeWidth={1.6}
          strokeLinejoin="round"
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
