import type { FukumenzanProblem } from "@/games/fukumenzan/problem/problem";
import { listFukumenzanLetters } from "@/games/fukumenzan/puzzle/equation";
import {
  listFukumenzanLeadingZeroLetters,
  listFukumenzanMiscalculatedColumns,
} from "@/games/fukumenzan/puzzle/rules";
import type {
  FukumenzanDigit,
  FukumenzanPuzzleState,
} from "@/games/fukumenzan/puzzle/state";
import { FukumenzanEquationBoard } from "@/games/fukumenzan/ui/board/FukumenzanEquationBoard";
import type { FukumenzanInputHandlers } from "@/games/fukumenzan/ui/board/use-fukumenzan-input";

type EquationFigureProps = {
  problem: FukumenzanProblem;
  /** 文字ごとに入れた札。書かない文字は空。 */
  placed: Readonly<Record<string, FukumenzanDigit>>;
  /** 式のマス1つの一辺（rem）。 */
  tileRem: number;
  label: string;
};

function ignore() {}

const staticHandlers: FukumenzanInputHandlers = {
  onPointerDown: ignore,
  onPointerMove: ignore,
  onPointerUp: ignore,
  onPointerCancel: ignore,
  onClick: ignore,
};

function getStaticHandlers() {
  return staticHandlers;
}

/**
 * 遊び方の図にする、本番の盤面部品で描いた押しても何も起きない式。先頭の0と計算違いの知らせは本番と同じ規則で求める。
 * 本番の盤面はマスの大きさを置き場所の大きさから決めるので、マスの大きさから置き場所の大きさを決めて渡す。
 */
export function EquationFigure({
  problem,
  placed,
  tileRem,
  label,
}: EquationFigureProps) {
  const letters = listFukumenzanLetters(problem);
  const puzzleState: FukumenzanPuzzleState = {
    placedDigits: letters.map((letter) => placed[letter] ?? null),
    crossedDigits: letters.map(() => []),
  };
  const columnCount = problem.result.length + 1;
  const rowCount = problem.addends.length + 1;

  return (
    <div
      role="img"
      aria-label={label}
      inert
      className="[container-type:size]"
      style={{
        width: `${columnCount * tileRem}rem`,
        height: `${rowCount * tileRem + 1}rem`,
      }}
    >
      <FukumenzanEquationBoard
        problem={problem}
        letters={letters}
        puzzleState={puzzleState}
        leadingZeroLetters={listFukumenzanLeadingZeroLetters(
          problem,
          puzzleState,
        )}
        miscalculatedColumns={listFukumenzanMiscalculatedColumns(
          problem,
          puzzleState,
        )}
        selection={null}
        drag={null}
        clearing={false}
        interactionDisabled
        getLetterHandlers={getStaticHandlers}
        onClearAnimationComplete={ignore}
      />
    </div>
  );
}
