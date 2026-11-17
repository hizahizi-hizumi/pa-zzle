import { restoreMinesweeperProblemWithoutAnalysis } from "@/games/minesweeper/problem/generator";
import {
  listMinesweeperPoolEntries,
  toMinesweeperPoolIdentity,
} from "@/games/minesweeper/problem/problem-pool";
import { collectMinesweeperRevealCellIndices } from "@/games/minesweeper/puzzle/rules";
import {
  chordMinesweeperExampleCell,
  createMinesweeperExampleBoard,
  revealMinesweeperExampleCell,
} from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/example-board";
import {
  goalFigure,
  mistakeCountMoves,
  mistakeCountStart,
} from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/figure-boards";

describe("goalFigure", () => {
  const goal = createMinesweeperExampleBoard(goalFigure);
  /** 問題集のレベル1の項目（行・列・地雷の数・候補の番号）。 */
  const poolEntry = [9, 9, 9, 8] as const;

  test("本番の問題と同じく、右下の角から続けて開いた姿で始まること", () => {
    const initialReveal = collectMinesweeperRevealCellIndices(goal.board, [80]);

    expect(goal.puzzle.revealedCellIndices).toEqual(initialReveal);
  });

  test("レベル1の問題集の 9×9・地雷9個の問題と同じ地雷の置き場所と初期開示であること", () => {
    const { problem } = restoreMinesweeperProblemWithoutAnalysis(
      toMinesweeperPoolIdentity("1", poolEntry),
    );

    expect(listMinesweeperPoolEntries("1")).toContainEqual(poolEntry);
    expect(goal.board).toEqual(problem.board);
    expect(goal.puzzle.revealedCellIndices).toEqual(
      problem.initialRevealedCellIndices,
    );
  });
});

describe("mistakeCountStart", () => {
  const start = createMinesweeperExampleBoard(mistakeCountStart);

  test("地雷のマスを開くと、地雷を1個踏むこと", () => {
    const next = revealMinesweeperExampleCell(
      start,
      mistakeCountMoves.mine.cellIndex,
    );

    expect(next.puzzle.steppedMineCellIndices).toEqual([0]);
  });

  test("旗の場所が違う2を押すと、1回の操作で地雷を2個踏むこと", () => {
    const next = chordMinesweeperExampleCell(
      start,
      mistakeCountMoves.chord.cellIndex,
    );

    expect(next.puzzle.steppedMineCellIndices).toEqual([0, 2]);
  });
});
