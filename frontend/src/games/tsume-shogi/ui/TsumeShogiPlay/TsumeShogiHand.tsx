import type { ReactNode } from "react";

import {
  type TsumeShogiHand as TsumeShogiHandCounts,
  type TsumeShogiHandPieceType,
  tsumeShogiHandPieceTypes,
} from "@/games/tsume-shogi/puzzle/position";
import { TsumeShogiPieceGlyph } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph";
import { tsumeShogiHandPieceNames } from "@/games/tsume-shogi/ui/piece-label";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

type TsumeShogiHandProps = {
  hand: TsumeShogiHandCounts;
  selectedPieceType: TsumeShogiHandPieceType | null;
  disabled: boolean;
  /** 駒台の右端に置く操作。 */
  trailingAction?: ReactNode;
  onSelectHandPiece: (pieceType: TsumeShogiHandPieceType) => void;
};

/**
 * 攻方の持駒。盤の下の、盤と同じ幅の駒台に並べ、押して選んでから空いた升を押して打つ。2枚以上は枚数を添える。
 */
export function TsumeShogiHand({
  hand,
  selectedPieceType,
  disabled,
  trailingAction,
  onSelectHandPiece,
}: TsumeShogiHandProps) {
  const pieceTypes = tsumeShogiHandPieceTypes.filter((type) => hand[type] > 0);

  return (
    <div
      className={cn(
        "flex size-full min-w-0 items-center gap-2 rounded-md px-2",
        tsumeShogiToneClassNames.komadai,
      )}
    >
      <span
        className={cn(
          "shrink-0 text-play-meta",
          tsumeShogiToneClassNames.coordinate,
        )}
      >
        持駒
      </span>
      <div
        role="group"
        aria-label="攻方の持駒"
        className="flex min-w-0 flex-1 flex-wrap gap-1"
      >
        {pieceTypes.length === 0 && (
          <span
            className={cn(
              "text-play-meta",
              tsumeShogiToneClassNames.coordinate,
            )}
          >
            なし
          </span>
        )}
        {pieceTypes.map((type) => {
          const selected = selectedPieceType === type;
          return (
            <button
              key={type}
              type="button"
              aria-label={`${tsumeShogiHandPieceNames[type]} ${hand[type]}枚`}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onSelectHandPiece(type)}
              className={cn(
                "relative flex h-10 min-w-10 touch-manipulation select-none items-center justify-center rounded-md px-1 outline-none transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-foreground/70 disabled:cursor-default",
                tsumeShogiToneClassNames.handHover,
                selected && tsumeShogiToneClassNames.handSelected,
              )}
            >
              <span
                className={cn(
                  "flex transition-transform duration-(--duration-fast)",
                  selected && "-translate-y-0.5",
                )}
              >
                <TsumeShogiPieceGlyph type={type} side="attacker" size="hand" />
              </span>
              {hand[type] > 1 && (
                <span className="absolute right-0 bottom-0 text-play-meta tabular-nums">
                  {hand[type]}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {trailingAction && <div className="shrink-0">{trailingAction}</div>}
    </div>
  );
}
