import { type ReactNode, useRef } from "react";

import { useTouchTap } from "@/components/touch-tap";
import {
  type TsumeShogiHand as TsumeShogiHandCounts,
  type TsumeShogiHandPieceType,
  tsumeShogiHandPieceTypes,
} from "@/games/tsume-shogi/puzzle/position";
import type { TsumeShogiRejection } from "@/games/tsume-shogi/session/session";
import { TsumeShogiPieceGlyph } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph";
import { tsumeShogiHandPieceNames } from "@/games/tsume-shogi/ui/piece-label";
import {
  handCountClassName,
  handPieceRadiusClassName,
  komadaiClassName,
  komadaiLabelClassName,
  komadaiStyle,
  showsKomadaiLabel,
} from "@/games/tsume-shogi/ui/TsumeShogiPlay/komadai-surface";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { useRejectedPieceFeedback } from "@/games/tsume-shogi/ui/use-rejected-piece-feedback";
import { cn } from "@/lib/utils";

/**
 * 持駒を押せるか。
 * - `available`: 押して選べる。
 * - `waiting`: 玉方の応手を待つ短い間だけ押せない。見た目は変えず、フォーカスも残す。
 * - `unavailable`: この筋が尽きた・詰んだなどで、戻すまで押せない。押せそうに見えないよう薄くする。
 */
export type TsumeShogiHandAvailability =
  | "available"
  | "waiting"
  | "unavailable";

type TsumeShogiHandProps = {
  hand: TsumeShogiHandCounts;
  selectedPieceType: TsumeShogiHandPieceType | null;
  availability: TsumeShogiHandAvailability;
  /** 直前の入力を着手させなかった。選んでいる持駒で返す。 */
  rejection: TsumeShogiRejection | null;
  /** 駒台の右端に置く操作。 */
  trailingAction?: ReactNode;
  onSelectHandPiece: (pieceType: TsumeShogiHandPieceType) => void;
};

const selectedHandPieceGlyphSelector = '[aria-pressed="true"] svg';

/**
 * 攻方の持駒。盤の下の、盤と同じ幅の駒台に並べ、押して選んでから空いた升を押して打つ。2枚以上は枚数を添える。
 */
export function TsumeShogiHand({
  hand,
  selectedPieceType,
  availability,
  rejection,
  trailingAction,
  onSelectHandPiece,
}: TsumeShogiHandProps) {
  const { getTapHandlers } = useTouchTap();
  const piecesRef = useRef<HTMLDivElement>(null);

  const rejectedPieceFlashing = useRejectedPieceFeedback(
    rejection,
    piecesRef,
    selectedHandPieceGlyphSelector,
  );

  const pieceTypes = tsumeShogiHandPieceTypes.filter((type) => hand[type] > 0);

  return (
    <div
      className={cn(
        "flex size-full min-w-0 items-center gap-2 px-2",
        komadaiClassName,
      )}
      style={komadaiStyle}
    >
      {showsKomadaiLabel && (
        <span className={cn("shrink-0 text-play-meta", komadaiLabelClassName)}>
          持駒
        </span>
      )}
      <div
        ref={piecesRef}
        role="group"
        aria-label="攻方の持駒"
        className={cn(
          "flex min-w-0 flex-1 flex-wrap gap-1 transition-opacity duration-(--duration-fast)",
          availability === "unavailable" && "opacity-40",
        )}
      >
        {pieceTypes.length === 0 && (
          <span
            className={cn(
              "text-play-meta",
              komadaiLabelClassName,
              !showsKomadaiLabel && "sr-only",
            )}
          >
            なし
          </span>
        )}
        {pieceTypes.map((type) => {
          const selected = selectedPieceType === type;
          const tapHandlers = getTapHandlers(() => onSelectHandPiece(type));
          return (
            <button
              key={type}
              type="button"
              aria-label={`${tsumeShogiHandPieceNames[type]} ${hand[type]}枚`}
              aria-pressed={selected}
              aria-disabled={availability !== "available" || undefined}
              onPointerUp={tapHandlers.onPointerUp}
              onClick={tapHandlers.onClick}
              className={cn(
                "relative flex h-10 min-w-10 touch-manipulation select-none items-center justify-center gap-0.5 px-1 outline-none transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-solid aria-disabled:cursor-default",
                handPieceRadiusClassName,
                tsumeShogiToneClassNames.focusRing,
                tsumeShogiToneClassNames.handHover,
                selected &&
                  (rejectedPieceFlashing
                    ? tsumeShogiToneClassNames.handRejected
                    : tsumeShogiToneClassNames.handSelected),
              )}
            >
              <span
                className={cn(
                  "flex transition-transform duration-(--duration-fast)",
                  selected && "-translate-y-0.5",
                )}
              >
                <TsumeShogiPieceGlyph
                  type={type}
                  side="attacker"
                  size="hand"
                  lifted={selected}
                />
              </span>
              {/* 枚数は駒に重ねず、駒の右下の外に添える。 */}
              {hand[type] > 1 && (
                <span
                  className={cn(
                    "self-end text-play-meta tabular-nums",
                    handCountClassName,
                  )}
                >
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
