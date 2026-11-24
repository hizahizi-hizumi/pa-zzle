import type { CSSProperties } from "react";

import { listFukumenzanLetters } from "@/games/fukumenzan/puzzle/equation";
import {
  listFukumenzanLeadingZeroLetters,
  listFukumenzanMiscalculatedColumns,
} from "@/games/fukumenzan/puzzle/rules";
import { FukumenzanEquationBoard } from "@/games/fukumenzan/ui/board/FukumenzanEquationBoard";
import { ExampleGround } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/ExampleGround";
import { createExamplePuzzleState } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-board";
import {
  type FukumenzanHowToPlayExample,
  howToPlayProblem,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-definitions";
import { HOW_TO_PLAY_TILE_REM } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/figure-size";
import {
  getStaticLetterHandlers,
  ignoreFigureEvent,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/static-input";

type EquationFigureProps = {
  figure: Pick<FukumenzanHowToPlayExample, "placed" | "crossed">;
  label: string;
};

const letters = listFukumenzanLetters(howToPlayProblem);
const columnCount = howToPlayProblem.result.length + 1;
const rowCount = howToPlayProblem.addends.length + 1;

// 本番の盤面はマスの大きさを置き場所の大きさから決めるので、マスの大きさから置き場所の大きさを決めて渡す。
const equationStyle = {
  width: `${columnCount * HOW_TO_PLAY_TILE_REM}rem`,
  height: `${rowCount * HOW_TO_PLAY_TILE_REM + 1}rem`,
} satisfies CSSProperties;

/** 押せない図にする、本番の盤面部品で描いた式。先頭の0と計算違いの知らせは本番と同じ関数で求める。 */
export function EquationFigure({ figure, label }: EquationFigureProps) {
  const puzzleState = createExamplePuzzleState(figure);

  return (
    <ExampleGround>
      <div
        role="img"
        aria-label={label}
        inert
        className="[container-type:size]"
        style={equationStyle}
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
          selection={null}
          drag={null}
          clearing={false}
          interactionDisabled
          getLetterHandlers={getStaticLetterHandlers}
          onClearAnimationComplete={ignoreFigureEvent}
        />
      </div>
    </ExampleGround>
  );
}
