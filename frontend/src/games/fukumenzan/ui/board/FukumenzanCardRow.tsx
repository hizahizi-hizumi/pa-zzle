import type { ReactNode } from "react";

import {
  type FukumenzanDigit,
  type FukumenzanPuzzleState,
  fukumenzanDigits,
} from "@/games/fukumenzan/puzzle/state";
import { FukumenzanCardFace } from "@/games/fukumenzan/ui/board/FukumenzanCardFace";
import {
  type FukumenzanCardDrag,
  type FukumenzanInputHandlers,
  type FukumenzanSelection,
  fukumenzanDropTargetAttributes,
} from "@/games/fukumenzan/ui/board/use-fukumenzan-input";
import { fukumenzanToneClassNames } from "@/games/fukumenzan/ui/fukumenzan-tone";
import { cn } from "@/lib/utils";

type FukumenzanCardRowProps = {
  puzzleState: FukumenzanPuzzleState;
  selection: FukumenzanSelection;
  drag: FukumenzanCardDrag | null;
  interactionDisabled: boolean;
  getCardHandlers: (digit: FukumenzanDigit) => FukumenzanInputHandlers;
  getEmptySlotHandlers: () => FukumenzanInputHandlers;
  /** 遊び方の例で、札かその札の空いた場所に重ねる、押す所の手がかり。 */
  hint?: { digit: FukumenzanDigit; content: ReactNode } | null;
  /** 遊び方の例で見せる、列の片方の段の5枚。渡さなければ10枚を並べる。 */
  shownDigits?: readonly FukumenzanDigit[];
  /**
   * 指のスクロールを止める所。渡さなければ札と空いた場所の全部で止める。
   * `cards` は運べる札だけで止め、押すだけの空いた場所では止めない（遊び方の例）。
   */
  scrollLock?: "all-slots" | "cards";
  /**
   * 札の段の組み方。`fit` は画面の幅で決める（スマホの幅では2段、広い画面では1段）。`two-rows` は画面の幅によらず5枚ずつの段にし、
   * 札の並びを式の幅にそろえる遊び方の例が使う。
   */
  layout?: "fit" | "two-rows";
};

const slotClassName =
  "relative flex h-full min-w-0 select-none items-center justify-center [-webkit-touch-callout:none] [container-type:size] rounded-[14%] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid";

/**
 * 0〜9 の札を、数字の順に決まった場所へ並べる。スマホの幅では 0〜4 と 5〜9 の2段、広い画面では1段にする。
 * 文字に入れた札は列から抜け、その場所は空いた枠になる。
 * 文字を選んでいる間は、その文字に × を付けた札に × を描き、札の数字を薄くする。
 */
export function FukumenzanCardRow({
  puzzleState,
  selection,
  drag,
  interactionDisabled,
  getCardHandlers,
  getEmptySlotHandlers,
  hint = null,
  shownDigits = fukumenzanDigits,
  scrollLock = "all-slots",
  layout = "fit",
}: FukumenzanCardRowProps) {
  const crossedDigits =
    selection?.kind === "letter"
      ? (puzzleState.crossedDigits[selection.letter] ?? [])
      : [];

  return (
    <div
      role="group"
      aria-label="札"
      {...fukumenzanDropTargetAttributes.cardRow}
      className={cn(
        "grid grid-cols-5",
        layout === "fit"
          ? [
              "auto-rows-[3.25rem] gap-1.5",
              // 1段に10枚だと 320px の幅で札が約26px と押しにくいので、狭い画面では2段にして札の幅を指の大きさに近づける。
              shownDigits.length > 5 &&
                "sm:auto-rows-[4.5rem] sm:grid-cols-10 sm:gap-2",
            ]
          : // 式のマスの 48px の幅にそろえた並びで、札の幅を 44px 以上に保つよう、札の間を狭くする。
            "auto-rows-[3.25rem] gap-1 lg:auto-rows-[3.75rem] lg:gap-1.5",
      )}
    >
      {shownDigits.map((digit) => {
        const hintContent = hint?.digit === digit ? hint.content : null;
        if (puzzleState.placedDigits.includes(digit)) {
          return (
            <button
              key={digit}
              type="button"
              aria-label={`${digit} の札の場所`}
              aria-disabled={interactionDisabled}
              className={cn(
                slotClassName,
                fukumenzanToneClassNames.selection,
                "border-2 border-dashed",
                fukumenzanToneClassNames.cardSlot,
                scrollLock === "cards" ? "touch-manipulation" : "touch-none",
              )}
              {...getEmptySlotHandlers()}
            >
              {hintContent}
            </button>
          );
        }
        const crossed = crossedDigits.includes(digit);
        const selected =
          selection?.kind === "card" && selection.digit === digit;
        return (
          <button
            key={digit}
            type="button"
            aria-label={crossed ? `${digit} の札（×）` : `${digit} の札`}
            aria-pressed={selected}
            aria-disabled={interactionDisabled}
            className={cn(
              slotClassName,
              "touch-none",
              fukumenzanToneClassNames.selection,
              selected && "-translate-y-1 outline-3 outline-solid",
            )}
            {...getCardHandlers(digit)}
          >
            <FukumenzanCardFace
              digit={digit}
              crossed={crossed}
              lifted={
                drag !== null &&
                drag.fromLetter === null &&
                drag.digit === digit
              }
            />
            {crossed && (
              <svg
                aria-hidden="true"
                viewBox="0 0 10 10"
                className="pointer-events-none absolute inset-[10%] size-[80%]"
              >
                <path
                  d="M 1.5 1.5 L 8.5 8.5 M 8.5 1.5 L 1.5 8.5"
                  fill="none"
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  className={fukumenzanToneClassNames.cross}
                />
              </svg>
            )}
            {hintContent}
          </button>
        );
      })}
    </div>
  );
}
