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
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * 升の地が示す状態。
 * - `selected`: 選んでいる攻方の駒。
 * - `rejected`: 選んでいる攻方の駒で、直前の入力を着手させなかったことを返している間（動きを減らす設定）。
 * - `last-move`: 最後に指した手の移動先。
 * - `refutation`: 誤王手への玉方の反証の移動先。
 * - `mated`: 詰んだ玉。地は変えず、玉を傾ける。
 */
export type TsumeShogiSquareHighlight =
  | "selected"
  | "rejected"
  | "last-move"
  | "refutation"
  | "mated";

const highlightClassNames = {
  selected: tsumeShogiToneClassNames.squareSelected,
  rejected: tsumeShogiToneClassNames.squareRejected,
  "last-move": tsumeShogiToneClassNames.squareLastMove,
  refutation: tsumeShogiToneClassNames.squareRefutation,
  // 詰みは升の地を変えず、玉の傾き（`matedPieceTilt`）と盤の照りの波で示す。
  mated: "",
} as const satisfies Record<TsumeShogiSquareHighlight, string>;

/** 盤に指した駒が動く時間。玉方の応手は攻方の手より少し長くし、どの駒が動いたかを目で追えるようにする。 */
const arrivalDurationMs = { attacker: 140, defender: 220 } as const;
const ARRIVAL_EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";

type TsumeShogiSquareButtonProps = {
  square: TsumeShogiSquare;
  piece: TsumeShogiPiece | null;
  /** 駒の、指し手で変わらない識別。駒ごとの木目の位置を決める。 */
  pieceId: string | null;
  /** 詰みの波で一度だけ光る層を置く。 */
  clearGlow: boolean;
  /** この升へ指した手。駒を移動元から滑らせる（打った駒は浮かび上がらせる）。 */
  arrivedMove: TsumeShogiPlayedMove | null;
  highlight: TsumeShogiSquareHighlight | null;
  /** 押しても何もしない。応手を待つ間などに押せなくしても、フォーカスは升に残す。 */
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
      prefersReducedMotion()
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
      easing: ARRIVAL_EASING,
    });
    return () => animation.cancel();
  }, [arrivedMove]);

  return pieceRef;
}

export function TsumeShogiSquareButton({
  square,
  piece,
  pieceId,
  clearGlow,
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
  // 選べるのは攻方の駒の升だけなので、その升だけを選択の切り替えとして読み上げる。
  const selectable = piece?.side === "attacker";
  const selected = highlight === "selected" || highlight === "rejected";

  return (
    <button
      type="button"
      aria-label={`${formatTsumeShogiSquare(square)}${pieceLabel}`}
      aria-pressed={selectable ? selected : undefined}
      aria-disabled={disabled || undefined}
      data-file={square.file}
      data-rank={square.rank}
      data-mated-king={highlight === "mated" ? "" : undefined}
      onPointerUp={tapHandlers.onPointerUp}
      onClick={tapHandlers.onClick}
      className={cn(
        "relative flex min-h-0 min-w-0 touch-manipulation select-none items-center justify-center outline-none transition-colors duration-(--duration-fast) focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 aria-disabled:cursor-default",
        tsumeShogiToneClassNames.boardLine,
        !isLastFile && "border-r",
        !isLastRank && "border-b",
        tsumeShogiToneClassNames.focusRing,
        highlight && highlightClassNames[highlight],
      )}
    >
      {clearGlow && (
        // 詰みの波で一度だけ光る層。ふだんは見えない。
        <span
          data-clear-glow=""
          className={cn(
            "pointer-events-none absolute inset-0 opacity-0",
            tsumeShogiToneClassNames.clearGlow,
          )}
        />
      )}
      {piece && (
        <span
          // 指した手ごとに作り直し、到着の動きを1回だけ流す。
          key={arrivedMove ? JSON.stringify(arrivedMove.move) : "still"}
          ref={pieceRef}
          data-piece=""
          data-selected-piece={selected ? "" : undefined}
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-transform duration-(--duration-fast)",
            selected && tsumeShogiToneClassNames.pieceLift,
            highlight === "mated" && tsumeShogiToneClassNames.matedPieceTilt,
          )}
        >
          <TsumeShogiPieceGlyph
            type={piece.type}
            side={piece.side}
            size="board"
            lifted={selected}
            grainSeed={pieceId ?? formatTsumeShogiSquare(square)}
          />
        </span>
      )}
    </button>
  );
}
