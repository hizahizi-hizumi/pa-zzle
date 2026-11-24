import { listFukumenzanLetters } from "@/games/fukumenzan/puzzle/equation";
import {
  listFukumenzanLeadingZeroLetters,
  listFukumenzanMiscalculatedColumns,
} from "@/games/fukumenzan/puzzle/rules";
import { FukumenzanCardRow } from "@/games/fukumenzan/ui/board/FukumenzanCardRow";
import { FukumenzanEquationBoard } from "@/games/fukumenzan/ui/board/FukumenzanEquationBoard";
import {
  createExamplePuzzleState,
  getExampleLetterIndex,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-board";
import {
  type FukumenzanHowToPlayExample,
  howToPlayProblem,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-definitions";
import {
  exampleEquationStyle,
  exampleUnitClassName,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/figure-size";
import {
  getStaticLetterHandlers,
  ignoreFigureEvent,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/static-input";
import { cn } from "@/lib/utils";

type EquationFigureProps = {
  figure: Pick<FukumenzanHowToPlayExample, "placed" | "crossed">;
  label: string;
  /** 本番の選んだ姿で示す文字。渡すと、式の下に 0〜9 の札の並びを置き、その文字に付けた × を札に描く。 */
  selectedLetter?: string;
};

const letters = listFukumenzanLetters(howToPlayProblem);

/**
 * 押せない図にする、本番の盤面部品で描いた式。先頭の0と計算違いの知らせは本番と同じ関数で求める。
 * 選んだ文字を渡すと、本番と同じく選んだ文字の × を札に描いた札の並びも見せる。
 */
export function EquationFigure({
  figure,
  label,
  selectedLetter,
}: EquationFigureProps) {
  const puzzleState = createExamplePuzzleState(figure);
  const selection =
    selectedLetter === undefined
      ? null
      : ({
          kind: "letter",
          letter: getExampleLetterIndex(selectedLetter),
        } as const);

  return (
    <div
      role="img"
      aria-label={label}
      inert
      className={cn("grid gap-3", exampleUnitClassName)}
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
          selection={selection}
          drag={null}
          clearing={false}
          interactionDisabled
          getLetterHandlers={getStaticLetterHandlers}
          onClearAnimationComplete={ignoreFigureEvent}
        />
      </div>
      {selection === null ? null : (
        <div style={{ width: exampleEquationStyle.width }}>
          <FukumenzanCardRow
            puzzleState={puzzleState}
            selection={selection}
            drag={null}
            interactionDisabled
            getCardHandlers={getStaticLetterHandlers}
            getEmptySlotHandlers={getStaticLetterHandlers}
            layout="two-rows"
          />
        </div>
      )}
    </div>
  );
}
