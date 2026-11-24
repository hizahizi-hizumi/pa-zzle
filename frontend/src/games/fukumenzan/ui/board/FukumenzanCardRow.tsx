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
};

const slotClassName =
  "relative flex h-full min-w-0 touch-none select-none items-center justify-center [-webkit-touch-callout:none] [container-type:size] rounded-[14%] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid";

/**
 * 0〜9 の札を、数字の順に決まった場所へ1段に並べる。文字に入れた札は列から抜け、その場所は空いた枠になる。
 * 文字を選んでいる間は、その文字に × を付けた札に × を描く。
 */
export function FukumenzanCardRow({
  puzzleState,
  selection,
  drag,
  interactionDisabled,
  getCardHandlers,
  getEmptySlotHandlers,
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
      className="grid h-14 grid-cols-10 gap-1"
    >
      {fukumenzanDigits.map((digit) => {
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
              )}
              {...getEmptySlotHandlers()}
            />
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
              fukumenzanToneClassNames.selection,
              selected && "-translate-y-1 outline-3 outline-solid",
            )}
            {...getCardHandlers(digit)}
          >
            <FukumenzanCardFace
              digit={digit}
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
                className="pointer-events-none absolute inset-[12%] size-[76%]"
              >
                <path
                  d="M 1.5 1.5 L 8.5 8.5 M 8.5 1.5 L 1.5 8.5"
                  fill="none"
                  strokeWidth={1}
                  strokeLinecap="round"
                  className={fukumenzanToneClassNames.cross}
                />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
