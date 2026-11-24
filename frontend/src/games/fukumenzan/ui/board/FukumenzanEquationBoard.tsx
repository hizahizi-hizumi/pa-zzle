import { type CSSProperties, useEffect, useEffectEvent, useRef } from "react";

import type { FukumenzanProblem } from "@/games/fukumenzan/problem/problem";
import type { FukumenzanPuzzleState } from "@/games/fukumenzan/puzzle/state";
import { FukumenzanCardFace } from "@/games/fukumenzan/ui/board/FukumenzanCardFace";
import {
  type FukumenzanCardDrag,
  type FukumenzanInputHandlers,
  type FukumenzanSelection,
  fukumenzanDropTargetAttributes,
} from "@/games/fukumenzan/ui/board/use-fukumenzan-input";
import { fukumenzanToneClassNames } from "@/games/fukumenzan/ui/fukumenzan-tone";
import { MOTION_EASING, playAnimations } from "@/lib/motion";
import { cn } from "@/lib/utils";

type FukumenzanEquationBoardProps = {
  problem: FukumenzanProblem;
  letters: readonly string[];
  puzzleState: FukumenzanPuzzleState;
  leadingZeroLetters: readonly number[];
  miscalculatedColumns: readonly number[];
  selection: FukumenzanSelection;
  drag: FukumenzanCardDrag | null;
  clearing: boolean;
  interactionDisabled: boolean;
  getLetterHandlers: (letter: number) => FukumenzanInputHandlers;
  onClearAnimationComplete: () => void;
};

/** 答えの桁を、一の位から順に1つずつ跳ねさせる間隔と長さ。筆算を右から確かめ終える手つき。 */
const CLEAR_STEP_MS = 110;
const CLEAR_HOP_MS = 360;
const CLEAR_HOLD_MS = 450;
const CLEAR_REDUCED_MOTION_HOLD_MS = 700;

/**
 * 筆算の形の式。足す数を右をそろえて上から並べ、最後の足す数の左に + を書き、線を引いて答えを書く。
 * 文字のマスは、空なら文字を、札を入れたら札の面だけを描く。同じ文字のマスは全部同じ札になる。
 * 選んでいる文字と、運んでいる札の下にある文字は、その文字の全部のマスを輪郭で示す。
 * 先頭の0は先頭のマスの札を赤く、計算違いの桁は答えのマスの下に赤い線を引く。
 */
export function FukumenzanEquationBoard({
  problem,
  letters,
  puzzleState,
  leadingZeroLetters,
  miscalculatedColumns,
  selection,
  drag,
  clearing,
  interactionDisabled,
  getLetterHandlers,
  onClearAnimationComplete,
}: FukumenzanEquationBoardProps) {
  const { addends, result } = problem;
  const columnCount = result.length + 1;
  const rowCount = addends.length + 1;
  const resultTileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const completeClearAnimation = useEffectEvent(onClearAnimationComplete);

  useEffect(() => {
    if (!clearing) {
      return;
    }
    return playAnimations({
      animate() {
        return resultTileRefs.current
          .slice(0, result.length)
          .toReversed()
          .flatMap((tile, place) =>
            typeof tile?.animate === "function"
              ? [
                  tile.animate(
                    [
                      { transform: "translateY(0)" },
                      { transform: "translateY(-14%)" },
                      { transform: "translateY(0)" },
                    ],
                    {
                      duration: CLEAR_HOP_MS,
                      delay: place * CLEAR_STEP_MS,
                      easing: MOTION_EASING.celebrate,
                    },
                  ),
                ]
              : [],
          );
      },
      completion: { type: "after-animations", holdMs: CLEAR_HOLD_MS },
      reducedMotionHoldMs: CLEAR_REDUCED_MOTION_HOLD_MS,
      unanimatedHoldMs: 0,
      onFinished: completeClearAnimation,
    });
  }, [clearing, result.length]);

  const highlightedLetter =
    drag?.overLetter ??
    (selection?.kind === "letter" ? selection.letter : null);

  function renderTile(
    letterText: string,
    key: string,
    style: CSSProperties,
    resultPlace: number | null,
    leading: boolean,
  ) {
    const letter = letters.indexOf(letterText);
    const placed = puzzleState.placedDigits[letter] ?? null;
    const handlers = getLetterHandlers(letter);
    const underlined =
      resultPlace !== null && miscalculatedColumns.includes(resultPlace);
    return (
      <button
        key={key}
        type="button"
        ref={
          resultPlace === null
            ? undefined
            : (element) => {
                resultTileRefs.current[result.length - 1 - resultPlace] =
                  element;
              }
        }
        {...fukumenzanDropTargetAttributes.letter(letter)}
        aria-label={placed === null ? letterText : `${letterText} に ${placed}`}
        aria-pressed={highlightedLetter === letter}
        aria-disabled={interactionDisabled}
        className={cn(
          "relative flex touch-none select-none items-center justify-center p-[6%] [-webkit-touch-callout:none] [container-type:size]",
          "rounded-[18%] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid",
          fukumenzanToneClassNames.selection,
          highlightedLetter === letter && "outline-3 outline-solid",
        )}
        style={style}
        {...handlers}
      >
        {placed === null ? (
          <span
            className={cn(
              "font-sans font-semibold leading-none [font-size:62cqh]",
              fukumenzanToneClassNames.ink,
            )}
          >
            {letterText}
          </span>
        ) : (
          <FukumenzanCardFace
            digit={placed}
            noticed={leading && leadingZeroLetters.includes(letter)}
            lifted={drag !== null && drag.fromLetter === letter}
          />
        )}
        {underlined && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-x-[10%] -bottom-[4%] h-[8%] rounded-full",
              fukumenzanToneClassNames.noticeLine,
            )}
          />
        )}
      </button>
    );
  }

  function renderWord(word: string, row: number, resultRow: boolean) {
    return [...word].map((letterText, index) =>
      renderTile(
        letterText,
        `${row}-${index}`,
        { gridRow: row + 1, gridColumn: columnCount - word.length + index + 1 },
        resultRow ? word.length - 1 - index : null,
        index === 0 && word.length > 1,
      ),
    );
  }

  return (
    <div
      role="group"
      aria-label="式"
      className="grid"
      style={{
        // 罫線の行は細いので、マスの大きさは文字の行の数と + の列を含めた桁の数で決める。
        ["--fukumenzan-tile" as string]: `min(calc(100cqw / ${columnCount}), calc((100cqh - 1rem) / ${rowCount}), 4.5rem)`,
        gridTemplateColumns: `repeat(${columnCount}, var(--fukumenzan-tile))`,
        gridTemplateRows: `repeat(${addends.length}, var(--fukumenzan-tile)) 1rem var(--fukumenzan-tile)`,
      }}
    >
      {addends.flatMap((addend, row) => renderWord(addend, row, false))}
      <span
        aria-hidden="true"
        className={cn(
          "flex items-center justify-center font-sans font-semibold leading-none text-[calc(var(--fukumenzan-tile)*0.6)]",
          fukumenzanToneClassNames.ink,
        )}
        style={{ gridRow: addends.length, gridColumn: 1 }}
      >
        +
      </span>
      <span
        aria-hidden="true"
        className={cn("h-0.5 self-center", fukumenzanToneClassNames.inkLine)}
        style={{ gridRow: addends.length + 1, gridColumn: "1 / -1" }}
      />
      {renderWord(result, addends.length + 1, true)}
    </div>
  );
}
