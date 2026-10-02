import type {
  TsumeShogiPieceType,
  TsumeShogiSide,
} from "@/games/tsume-shogi/puzzle/position";
import { tsumeShogiPieceCharacters } from "@/games/tsume-shogi/ui/piece-label";
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

/** 駒の大きさ。`board` は升いっぱい、`hand` は持駒の欄、`figure` は遊び方の図。 */
const glyphSizeClassNames = {
  board: "h-[88%] w-[82%]",
  hand: "h-9 w-8",
  figure: "h-6 w-5",
} as const;

type TsumeShogiPieceGlyphProps = {
  type: TsumeShogiPieceType;
  side: TsumeShogiSide;
  size: keyof typeof glyphSizeClassNames;
};

/**
 * 五角形の駒に1文字を書いた駒。玉方の駒は将棋盤の慣例どおり 180° 回して、向きで攻方と見分ける。
 * 第三者の駒画像を使わず、図形と文字だけで描く。
 */
export function TsumeShogiPieceGlyph({
  type,
  side,
  size,
}: TsumeShogiPieceGlyphProps) {
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
      <polygon
        points="50,3 83,16 95,108 5,108 17,16"
        transform={side === "defender" ? "translate(0 -5)" : "translate(0 5)"}
        className={tsumeShogiToneClassNames.pieceShadow}
      />
      <polygon
        points="50,3 83,16 95,108 5,108 17,16"
        strokeWidth={3.5}
        strokeLinejoin="round"
        className={cn(
          tsumeShogiToneClassNames.pieceFill,
          tsumeShogiToneClassNames.pieceStroke,
        )}
      />
      <text
        x="50"
        y="66"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="58"
        fontWeight="600"
        fontFamily='"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif'
        className={
          promotedTypes.has(type)
            ? tsumeShogiToneClassNames.promotedText
            : tsumeShogiToneClassNames.pieceText
        }
      >
        {tsumeShogiPieceCharacters[type]}
      </text>
    </svg>
  );
}
