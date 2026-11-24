import { type CSSProperties, useCallback, useRef, useState } from "react";

import { HowToPlayExample } from "@/components/HowToPlayExample";
import { useReportHowToPlayExampleChange } from "@/components/HowToPlayExamplePanel";
import {
  HowToPlayPressHint,
  type HowToPlayPressHintPointer,
} from "@/components/HowToPlayPressHint";
import {
  HowToPlayVerdict,
  type HowToPlayVerdictLabels,
} from "@/components/HowToPlayVerdict";
import {
  type FukumenzanOperation,
  getFukumenzanCrossOperationType,
} from "@/games/fukumenzan/play/use-fukumenzan-play";
import { listFukumenzanLetters } from "@/games/fukumenzan/puzzle/equation";
import {
  isFukumenzanSolved,
  listFukumenzanLeadingZeroLetters,
  listFukumenzanMiscalculatedColumns,
} from "@/games/fukumenzan/puzzle/rules";
import type {
  FukumenzanDigit,
  FukumenzanPuzzleState,
} from "@/games/fukumenzan/puzzle/state";
import {
  placeFukumenzanDigit,
  returnFukumenzanDigit,
  toggleFukumenzanCross,
} from "@/games/fukumenzan/puzzle/transitions";
import { FukumenzanCardRow } from "@/games/fukumenzan/ui/board/FukumenzanCardRow";
import { FukumenzanDraggedCard } from "@/games/fukumenzan/ui/board/FukumenzanDraggedCard";
import { FukumenzanEquationBoard } from "@/games/fukumenzan/ui/board/FukumenzanEquationBoard";
import {
  type FukumenzanSelection,
  useFukumenzanInput,
} from "@/games/fukumenzan/ui/board/use-fukumenzan-input";
import {
  createExamplePuzzleState,
  describeOtherRuleMark,
  findExampleHint,
  getExampleLetterIndex,
  isExampleChanged,
  judgeExample,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-board";
import {
  exampleCardRows,
  type FukumenzanExampleVerdict,
  type FukumenzanHowToPlayExample,
  howToPlayProblem,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-definitions";
import {
  exampleEquationStyle,
  exampleUnitClassName,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/figure-size";
import { useFukumenzanSoundEffects } from "@/games/fukumenzan/ui/use-fukumenzan-sound-effects";
import { cn } from "@/lib/utils";

const letters = listFukumenzanLetters(howToPlayProblem);

/** 判定の言葉。押せない図の判定も同じ言葉で言う。 */
export const verdictLabels = {
  "leading-zero": { allowed: "できる", disallowed: "できない" },
  sum: { allowed: "合う", disallowed: "合わない" },
} as const satisfies Record<FukumenzanExampleVerdict, HowToPlayVerdictLabels>;

const exampleStyle = {
  "--how-to-play-unit": "var(--fukumenzan-example-unit)",
} as CSSProperties;

function renderHint(pointer: HowToPlayPressHintPointer) {
  return <HowToPlayPressHint frame="inside" pointer={pointer} />;
}

/**
 * 札の手がかりの指。空いた場所は中央に置く。× を描いた札は、角へ伸びる × の線を避けて下の縁に置く。
 * ほかの札は、数字を避けて角に置く。
 */
function getCardHintPointer(
  puzzleState: FukumenzanPuzzleState,
  selection: FukumenzanSelection,
  digit: FukumenzanDigit,
): HowToPlayPressHintPointer {
  if (puzzleState.placedDigits.includes(digit)) {
    return "center";
  }
  return selection?.kind === "letter" &&
    puzzleState.crossedDigits[selection.letter]?.includes(digit)
    ? "bottom-edge"
    : "inside-corner";
}

type TouchableExampleProps = {
  example: FukumenzanHowToPlayExample;
};

/**
 * 触れる例。本番の式と札の列の部品で、本番と同じに、札を文字へ運ぶ・札を押してから文字を押すと札が入り、
 * 文字を押してから札を押すと × を付け外しし、札の入った文字を押してから空いた場所を押すと札が列へ戻る。
 * 札の列は、例が使う札の段だけを見せる。先頭の0と計算違いの知らせは本番と同じ関数で出し直す。
 * 足し算が成り立つと本番のクリア演出を返し、それからは受け付けない。
 * 押す所の手がかりは、触る前の姿から例の手を打っていく途中でだけ付ける。
 * 音は本番と同じフックで鳴らす。
 * 盤面が触る前と違うかを例を並べる面に知らせ、最初の姿に戻すときは、面が例を作り直す。
 */
export function TouchableExample({ example }: TouchableExampleProps) {
  const [puzzleState, setPuzzleState] = useState(() =>
    createExamplePuzzleState(example),
  );
  // 盤面は、運んだ札を離すと選びを解く知らせと札を入れる手を続けて送る。次の手を今の姿へ当てるため、姿を同時に持つ。
  const puzzleStateRef = useRef(puzzleState);
  const [clearAnimationDone, setClearAnimationDone] = useState(false);
  const [operation, setOperation] = useState<FukumenzanOperation | null>(null);
  const reportChange = useReportHowToPlayExampleChange();
  const scopeRef = useRef<HTMLDivElement>(null);
  const solved = isFukumenzanSolved(howToPlayProblem, puzzleState);

  function apply(
    next: FukumenzanPuzzleState,
    type: FukumenzanOperation["type"],
  ): void {
    if (next === puzzleStateRef.current) {
      return;
    }
    puzzleStateRef.current = next;
    setPuzzleState(next);
    setOperation((current) => ({ id: (current?.id ?? 0) + 1, type }));
    reportChange(isExampleChanged(example, next));
  }

  const input = useFukumenzanInput({
    puzzleState,
    crossUndoNotice: null,
    interactionDisabled: solved,
    onPlaceDigit(letter: number, digit: FukumenzanDigit) {
      apply(
        placeFukumenzanDigit(puzzleStateRef.current, letter, digit),
        "placed",
      );
    },
    onReturnDigit(letter: number) {
      apply(returnFukumenzanDigit(puzzleStateRef.current, letter), "returned");
    },
    onToggleCross(letter: number, digit: FukumenzanDigit) {
      const next = toggleFukumenzanCross(puzzleStateRef.current, letter, digit);
      apply(next, getFukumenzanCrossOperationType(next, letter, digit));
    },
    dropScopeRef: scopeRef,
  });

  const clearing = solved && !clearAnimationDone;
  useFukumenzanSoundEffects(
    operation,
    !solved ? "playing" : clearing ? "clearing" : "result",
    howToPlayProblem.result.length,
  );

  const completeClearAnimation = useCallback(() => {
    setClearAnimationDone(true);
  }, []);

  const hint = solved
    ? null
    : findExampleHint(example, puzzleState, input.selection, input.drag);

  return (
    <HowToPlayExample
      figure={
        <div
          ref={scopeRef}
          className={cn("grid gap-3", exampleUnitClassName)}
          style={exampleStyle}
        >
          <div className="[container-type:size]" style={exampleEquationStyle}>
            <FukumenzanEquationBoard
              problem={howToPlayProblem}
              letters={letters}
              puzzleState={puzzleState}
              leadingZeroLetters={listFukumenzanLeadingZeroLetters(
                howToPlayProblem,
                puzzleState,
              )}
              miscalculatedColumns={listFukumenzanMiscalculatedColumns(
                howToPlayProblem,
                puzzleState,
              )}
              selection={input.selection}
              drag={input.drag}
              clearing={clearing}
              interactionDisabled={solved}
              getLetterHandlers={input.getLetterHandlers}
              onClearAnimationComplete={completeClearAnimation}
              hint={
                hint?.kind === "letter"
                  ? {
                      letter: getExampleLetterIndex(hint.letter),
                      content: renderHint("inside-corner"),
                    }
                  : null
              }
              scrollLock="placed-letters"
            />
          </div>
          <div style={{ width: exampleEquationStyle.width }}>
            <FukumenzanCardRow
              puzzleState={puzzleState}
              selection={input.selection}
              drag={input.drag}
              interactionDisabled={solved}
              getCardHandlers={input.getCardHandlers}
              getEmptySlotHandlers={input.getEmptySlotHandlers}
              hint={
                hint?.kind === "card"
                  ? {
                      digit: hint.digit,
                      content: renderHint(
                        getCardHintPointer(
                          puzzleState,
                          input.selection,
                          hint.digit,
                        ),
                      ),
                    }
                  : null
              }
              shownDigits={exampleCardRows[example.cardRow]}
              scrollLock="cards"
              layout="two-rows"
            />
          </div>
          {input.drag && (
            <FukumenzanDraggedCard drag={input.drag} size="compact" />
          )}
        </div>
      }
      caption={
        example.verdict === undefined ? undefined : (
          <HowToPlayVerdict
            verdict={judgeExample(example.verdict, puzzleState)}
            labels={verdictLabels[example.verdict]}
            reason={describeOtherRuleMark(example.verdict, puzzleState)}
          />
        )
      }
    />
  );
}
