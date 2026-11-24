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
  candidateFigureClassName,
  exampleCardRowClassName,
  exampleEquationStyle,
  exampleUnitStyle,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/figure-size";
import {
  getStaticLetterHandlers,
  ignoreFigureEvent,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/static-input";
import { exampleEquationAttributes } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/use-equation-grid";

type EquationFigureProps = {
  figure: Pick<FukumenzanHowToPlayExample, "placed" | "crossed">;
  label: string;
  /** 本番の選んだ姿で示す文字。その文字に付けた × を、式の下の 0〜9 の札の並びに描く。 */
  selectedLetter: string;
};

const letters = listFukumenzanLetters(howToPlayProblem);

/**
 * 押せない図にする、本番の盤面部品で描いた式と札の並び。文字を選んだ本番の姿で、選んだ文字の × を札に描く。
 * 先頭の0と計算違いの知らせは本番と同じ関数で求める。
 */
export function EquationFigure({
  figure,
  label,
  selectedLetter,
}: EquationFigureProps) {
  const puzzleState = createExamplePuzzleState(figure);
  const selection = {
    kind: "letter",
    letter: getExampleLetterIndex(selectedLetter),
  } as const;

  return (
    <div
      role="img"
      aria-label={label}
      inert
      className={candidateFigureClassName}
      style={exampleUnitStyle}
    >
      <div
        {...exampleEquationAttributes}
        className="[container-type:size]"
        style={exampleEquationStyle}
      >
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
      <div className={exampleCardRowClassName}>
        <FukumenzanCardRow
          puzzleState={puzzleState}
          selection={selection}
          drag={null}
          interactionDisabled
          getCardHandlers={getStaticLetterHandlers}
          getEmptySlotHandlers={getStaticLetterHandlers}
          layout="example"
        />
      </div>
    </div>
  );
}
