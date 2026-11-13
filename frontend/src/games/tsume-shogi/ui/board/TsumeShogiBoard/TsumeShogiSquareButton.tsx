import { useLayoutEffect, useRef } from "react";
import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import type { TapHandlers } from "@/components/touch-tap";
import type { TsumeShogiPlayedMove } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import type {
  TsumeShogiPiece,
  TsumeShogiSquare,
} from "@/games/tsume-shogi/puzzle/position";
import {
  TSUME_SHOGI_SQUARE_HEIGHT,
  TSUME_SHOGI_SQUARE_WIDTH,
} from "@/games/tsume-shogi/ui/board/piece-shape";
import { TsumeShogiPieceGlyph } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph";
import { pieceMotionSelector } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph/piece-glyph-frame";
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
 * - `rejected`: 選んでいる攻方の駒で、直前の入力を着手させなかったことを返している間。
 * - `last-move`: 最後に指した手の移動先。
 * - `refutation`: 誤王手への玉方の反証の移動先。
 * - `mated`: 詰んだ玉。
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
  clearGlow: boolean;
  /** 詰みの瞬間に、明暗の輪を一度だけ出す升（詰めた駒と詰んだ玉）。 */
  clearRing: boolean;
  arrivedMove: TsumeShogiPlayedMove | null;
  highlight: TsumeShogiSquareHighlight | null;
  /**
   * チュートリアルで次に押す升の印。`undefined` なら印を付けない。値は印の線を短く濃くし直す合図（`TutorialCue` の `recallId`）。
   */
  tutorialMarkRecallId: number | null | undefined;
  /** チュートリアルで手を引いている間、画面全体の覆いからこの升を抜く。 */
  spotlit: boolean;
  /** 押しても何もしない。応手を待つ間などに押せなくしても、フォーカスは升に残す。 */
  disabled: boolean;
  tapHandlers: TapHandlers;
  onLeftEdge: boolean;
  onTopEdge: boolean;
};

function useArrivalAnimation(arrivedMove: TsumeShogiPlayedMove | null) {
  const pieceRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const element = pieceRef.current?.querySelector(pieceMotionSelector);
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
              transform: `translate(${(move.to.file - move.from.file) * TSUME_SHOGI_SQUARE_WIDTH}px, ${(move.from.rank - move.to.rank) * TSUME_SHOGI_SQUARE_HEIGHT}px)`,
            },
            { transform: "translate(0px, 0px)" },
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
  clearRing,
  arrivedMove,
  highlight,
  tutorialMarkRecallId,
  spotlit,
  disabled,
  tapHandlers,
  onLeftEdge,
  onTopEdge,
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
        // 外枠も升の線で描く。盤に別の枠線を重ねると、枠と升の線の間が画素の丸めで途切れて見える。
        "border-r border-b",
        onLeftEdge && "border-l",
        onTopEdge && "border-t",
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
      {clearRing && (
        // 詰みの輪。ふだんは見えない。明るい内側の輪と暗い外側の輪で、木目の上でも卓の上でも見えるようにする。
        <span
          data-clear-ring=""
          className={cn(
            "pointer-events-none absolute inset-[4%] z-2 rounded-[22%] opacity-0",
            tsumeShogiToneClassNames.clearRing,
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
            // 持ち上げた駒と影は隣の升へはみ出すので、後ろの升の地に切られないよう前に出す。
            selected && "z-1",
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
      <TutorialSpotlight active={spotlit} className="inset-0" />
      {tutorialMarkRecallId !== undefined && (
        <TutorialCue kind="mark" recallId={tutorialMarkRecallId} />
      )}
    </button>
  );
}
