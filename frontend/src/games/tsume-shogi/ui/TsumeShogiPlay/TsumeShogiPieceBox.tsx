import { tsumeShogiRealToneClassNames as realTone } from "@/games/tsume-shogi/ui/board/real/real-tone";
import { tsumeShogiBoardStyle } from "@/games/tsume-shogi/ui/board-style";
import {
  komadaiClassName,
  komadaiLabelClassName,
  komadaiStyle,
} from "@/games/tsume-shogi/ui/TsumeShogiPlay/komadai-surface";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

/** 玉方向きの、文字の無い駒の輪郭。3枚を少しずつ傾けて重ね、駒箱の駒の山を表す。 */
const pilePieces = [
  { x: 0, rotate: -8 },
  { x: 7, rotate: 4 },
  { x: 14, rotate: -2 },
] as const;

/**
 * 玉方の持駒（駒箱）。盤上と攻方の持駒に無い駒はすべて玉方が使えるので、枚数を並べずに「残り全部」とだけ示す。
 * 盤の上の、攻方の駒台と同じ形の駒台に、文字の無い駒の山を添えて置く。
 * 案R では木の駒台を置かず、盤の外の画面の地に小さな札として出す（駒箱は盤の脇に置く箱で、駒台ではない）。
 */
export function TsumeShogiPieceBox() {
  const onWood = tsumeShogiBoardStyle !== "real";
  return (
    <p
      className={cn(
        "flex size-full items-center gap-2 text-play-meta",
        onWood
          ? cn("px-2", komadaiClassName, komadaiLabelClassName)
          : cn("items-end px-(--board-frame) pb-1", realTone.pieceBoxLabel),
      )}
      style={onWood ? komadaiStyle : undefined}
    >
      <svg viewBox="0 0 30 18" aria-hidden="true" className="h-3.5 w-6">
        {pilePieces.map(({ x, rotate }) => (
          <polygon
            key={x}
            points="0,1 12,1 10,13 6,16 2,13"
            transform={`translate(${x + 2} 1) rotate(${rotate} 6 8)`}
            strokeWidth={1}
            strokeLinejoin="round"
            className={cn(
              tsumeShogiToneClassNames.pieceFill,
              tsumeShogiToneClassNames.pieceStroke,
            )}
          />
        ))}
      </svg>
      <span>玉方の持駒</span>
      <span className="font-semibold">残り全部</span>
    </p>
  );
}
