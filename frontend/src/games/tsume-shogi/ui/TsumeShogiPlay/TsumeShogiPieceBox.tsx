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
 * 盤の左上の駒台に、文字の無い駒の山を添えて置く。
 */
export function TsumeShogiPieceBox() {
  return (
    <p
      className={cn(
        "inline-flex h-full items-center gap-1.5 rounded-sm pr-2 pl-1.5 text-play-meta",
        tsumeShogiToneClassNames.komadai,
        tsumeShogiToneClassNames.coordinate,
      )}
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
