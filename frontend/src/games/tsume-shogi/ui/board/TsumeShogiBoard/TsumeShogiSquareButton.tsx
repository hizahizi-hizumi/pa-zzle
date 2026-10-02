import { useLayoutEffect, useRef } from "react";
import type { TapHandlers } from "@/components/touch-tap";
import type { TsumeShogiPlayedMove } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import type {
  TsumeShogiPiece,
  TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import { TsumeShogiPieceGlyph } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph";
import {
  formatTsumeShogiSquare,
  tsumeShogiPieceNames,
} from "@/games/tsume-shogi/ui/piece-label";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

/**
 * 升の地が示す状態。
 * - `selected`: 選んでいる攻方の駒。
 * - `last-move`: 最後に指した手の移動先。
 * - `refutation`: 誤王手への玉方の反証の移動先。
 * - `rejected`: 着手させなかった入力の升。
 * - `mated`: 詰んだ玉。
 */
export type TsumeShogiSquareHighlight =
  | "selected"
  | "last-move"
  | "refutation"
  | "rejected"
  | "mated";

const highlightClassNames = {
  selected: tsumeShogiToneClassNames.squareSelected,
  "last-move": tsumeShogiToneClassNames.squareLastMove,
  refutation: tsumeShogiToneClassNames.squareRefutation,
  rejected: tsumeShogiToneClassNames.squareRejected,
  mated: tsumeShogiToneClassNames.squareMated,
} as const satisfies Record<TsumeShogiSquareHighlight, string>;

/** 盤に指した駒が動く時間。玉方の応手は攻方の手より少し長くし、どの駒が動いたかを目で追えるようにする。 */
const arrivalDurationMs = { attacker: 140, defender: 220 } as const;

type TsumeShogiSquareButtonProps = {
  square: TsumeShogiSquare;
  piece: TsumeShogiPiece | null;
  /** この升へ指した手。駒を移動元から滑らせる（打った駒は浮かび上がらせる）。 */
  arrivedMove: TsumeShogiPlayedMove | null;
  highlight: TsumeShogiSquareHighlight | null;
  disabled: boolean;
  tapHandlers: TapHandlers;
  isLastFile: boolean;
  isLastRank: boolean;
};

function useArrivalAnimation(arrivedMove: TsumeShogiPlayedMove | null) {
  const pieceRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const element = pieceRef.current;
    if (
      !arrivedMove ||
      !element ||
      typeof element.animate !== "function" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const { move, side } = arrivedMove;
    // 盤は左が9筋なので、筋が大きいほど左にある。
    const keyframes: Keyframe[] =
      move.kind === "board"
        ? [
            {
              transform: `translate(${(move.to.file - move.from.file) * 100}%, ${(move.from.rank - move.to.rank) * 100}%)`,
            },
            { transform: "translate(0, 0)" },
          ]
        : [
            { opacity: 0, transform: "scale(0.8)" },
            { opacity: 1, transform: "scale(1)" },
          ];
    const animation = element.animate(keyframes, {
      duration: arrivalDurationMs[side],
      easing: "cubic-bezier(.2,.8,.2,1)",
    });
    return () => animation.cancel();
  }, [arrivedMove]);

  return pieceRef;
}

export function TsumeShogiSquareButton({
  square,
  piece,
  arrivedMove,
  highlight,
  disabled,
  tapHandlers,
  isLastFile,
  isLastRank,
}: TsumeShogiSquareButtonProps) {
  const pieceRef = useArrivalAnimation(arrivedMove);
  const pieceLabel = piece
    ? ` ${piece.side === "attacker" ? "攻方" : "玉方"}の${tsumeShogiPieceNames[piece.type]}`
    : "";

  return (
    <button
      type="button"
      aria-label={`${formatTsumeShogiSquare(square)}${pieceLabel}`}
      aria-pressed={highlight === "selected"}
      disabled={disabled}
      data-mated-king={highlight === "mated" ? "" : undefined}
      onPointerUp={tapHandlers.onPointerUp}
      onClick={tapHandlers.onClick}
      className={cn(
        "relative flex min-h-0 min-w-0 touch-manipulation select-none items-center justify-center outline-none transition-colors duration-(--duration-fast) focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-foreground/70 disabled:cursor-default",
        tsumeShogiToneClassNames.boardLine,
        !isLastFile && "border-r",
        !isLastRank && "border-b",
        highlight && highlightClassNames[highlight],
      )}
    >
      {piece && (
        <span
          // 指した手ごとに作り直し、到着の動きを1回だけ流す。
          key={arrivedMove ? JSON.stringify(arrivedMove.move) : "still"}
          ref={pieceRef}
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-transform duration-(--duration-fast)",
            highlight === "selected" && "-translate-y-[6%]",
          )}
        >
          <TsumeShogiPieceGlyph
            type={piece.type}
            side={piece.side}
            size="board"
          />
        </span>
      )}
    </button>
  );
}
