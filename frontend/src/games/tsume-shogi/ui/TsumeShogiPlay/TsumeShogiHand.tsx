import type { ReactNode } from "react";

import {
  type TsumeShogiHand as TsumeShogiHandCounts,
  type TsumeShogiHandPieceType,
  tsumeShogiHandPieceTypes,
} from "@/games/tsume-shogi/puzzle/position";
import { TsumeShogiPieceGlyph } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceGlyph";
import { tsumeShogiHandPieceNames } from "@/games/tsume-shogi/ui/piece-label";
import { TsumeShogiKomadai } from "@/games/tsume-shogi/ui/TsumeShogiPlay/TsumeShogiHand/TsumeShogiKomadai";
import { tsumeShogiToneClassNames } from "@/games/tsume-shogi/ui/tsume-shogi-tone";
import { cn } from "@/lib/utils";

type TsumeShogiHandProps = {
  hand: TsumeShogiHandCounts;
  selectedPieceType: TsumeShogiHandPieceType | null;
  disabled: boolean;
  /** 駒台と同じ行の、左の空きに置く操作。駒台には重ねない。 */
  leadingAction?: ReactNode;
  onSelectHandPiece: (pieceType: TsumeShogiHandPieceType) => void;
};

/**
 * 攻方の持駒。盤の下の駒台（`TsumeShogiKomadai`）に並べ、押して選んでから空いた升を押して打つ。2枚以上は枚数を添える。
 */
export function TsumeShogiHand({
  hand,
  selectedPieceType,
  disabled,
  leadingAction,
  onSelectHandPiece,
}: TsumeShogiHandProps) {
  const pieceTypes = tsumeShogiHandPieceTypes.filter((type) => hand[type] > 0);

  return (
    <TsumeShogiKomadai leadingAction={leadingAction}>
      <div
        role="group"
        aria-label="攻方の持駒"
        className="flex min-w-0 flex-1 flex-wrap gap-1"
      >
        {/* 本物の駒台に札は無いので、持駒が無いことは読み上げにだけ伝える。 */}
        {pieceTypes.length === 0 && <span className="sr-only">なし</span>}
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
                "relative flex h-10 min-w-10 touch-manipulation select-none items-center justify-center gap-0.5 rounded-[2px] px-1 outline-none transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-solid disabled:cursor-default",
                tsumeShogiToneClassNames.focusRing,
                tsumeShogiToneClassNames.handHover,
                selected && tsumeShogiToneClassNames.handSelected,
              )}
            >
              <span
                className={cn(
                  "flex transition-transform duration-(--duration-fast)",
                  selected && tsumeShogiToneClassNames.pieceLift,
                )}
              >
                <TsumeShogiPieceGlyph
                  type={type}
                  side="attacker"
                  size="hand"
                  lifted={selected}
                />
              </span>
              {/* 枚数は駒に重ねず、駒の右下の外に添える。1枚でも欄の幅を取り、枚数が変わっても並びをずらさない。 */}
              <span
                className={cn(
                  "w-[1ch] self-end text-play-meta tabular-nums",
                  tsumeShogiToneClassNames.handCount,
                )}
              >
                {hand[type] > 1 ? hand[type] : null}
              </span>
            </button>
          );
        })}
      </div>
    </TsumeShogiKomadai>
  );
}
