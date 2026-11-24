import { difficultyLevels } from "@/games/difficulty";
import { inputMagicSquareValue } from "@/games/magic-square/play/use-magic-square-play";
import { magicSquareExampleSquares } from "@/games/magic-square/problem/example-squares";
import { countMagicSquareSolutions } from "@/games/magic-square/problem/generation/solver";
import {
  listMagicSquarePoolEntries,
  restoreMagicSquarePoolEntry,
} from "@/games/magic-square/problem/problem-pool";
import {
  evaluateMagicSquareLine,
  isMagicSquareLineViolation,
  listMagicSquareLineEvaluations,
} from "@/games/magic-square/puzzle/rules";
import {
  type MagicSquareSession,
  selectMagicSquareSessionCell,
} from "@/games/magic-square/session/session";
import { magicSquareTutorialPuzzle } from "@/games/magic-square/tutorial/tutorial";
import { createMagicSquareExampleSession } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/example-board";
import {
  correctionCountFlows,
  givenRuleExample,
  goalBoard,
  lineRuleExample,
  listMagicSquareReadingOrder,
  type MagicSquareHowToPlayExample,
  memoClearedOperationExample,
  memoOperationExample,
  placeOperationExample,
  replaceOperationExample,
  usedValueRuleExample,
} from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/figure-boards";

const examples = {
  lineRuleExample,
  usedValueRuleExample,
  givenRuleExample,
  placeOperationExample,
  replaceOperationExample,
  memoOperationExample,
  memoClearedOperationExample,
};

function hasViolatedLine(session: MagicSquareSession): boolean {
  return listMagicSquareLineEvaluations(session.puzzleState).some(
    ({ status }) => isMagicSquareLineViolation(status),
  );
}

/** 手がかりの手を本番のプレイと同じ関数で順に押し、押すたびの盤面を返す。 */
function followHints(example: MagicSquareHowToPlayExample) {
  let sessions = example.boards.map(createMagicSquareExampleSession);
  let selectedBoard: number | null = null;
  let inputMode: "value" | "memo" = "value";
  return example.hints.map((press) => {
    switch (press.kind) {
      case "cell":
        selectedBoard = press.board;
        sessions = sessions.map((session, index) =>
          index === press.board
            ? selectMagicSquareSessionCell(session, press.cellIndex)
            : session,
        );
        break;
      case "memo":
        inputMode = inputMode === "memo" ? "value" : "memo";
        break;
      case "value":
        sessions = sessions.map((session, index) =>
          index === selectedBoard
            ? inputMagicSquareValue(session, inputMode, press.value, 0).session
            : session,
        );
        break;
    }
    return sessions;
  });
}

function toGrid(cells: readonly (number | null)[]): number[] {
  return cells.map((cell) => cell ?? 0);
}

describe("例の盤面", () => {
  test.each(Object.entries(examples))(
    "%s は、書いた数をどれも本番の操作で置けて、最初から置いてある数だけでは違反の列が無いこと",
    (_, example) => {
      const accepted = example.boards.map((board) => {
        const session = createMagicSquareExampleSession(board);
        const written = board.rows
          .flatMap((row) => row.trim().split(/\s+/))
          .filter((token) => token !== ".").length;
        const filled = session.puzzleState.cells.filter(
          (cell) => cell !== null,
        ).length;
        const givensOnly = {
          ...session,
          puzzleState: {
            ...session.puzzleState,
            cells: session.problem.givens.cells,
          },
        };
        return filled === written && !hasViolatedLine(givensOnly);
      });

      expect(accepted.every(Boolean)).toBe(true);
    },
  );

  test.each(
    Object.entries(examples).filter(([name]) => name !== "lineRuleExample"),
  )("%s は、手がかりどおりに押す間に違反の列を出さないこと", (_, example) => {
    const violated = followHints(example).some((sessions) =>
      sessions.some(hasViolatedLine),
    );

    expect(violated).toBe(false);
  });

  test("列の合計のルールの例は、手がかりどおりに押すと、そろった行が埋まったまま合計と違う行になること", () => {
    const [firstBoard] = followHints(lineRuleExample).at(-1) ?? [];
    const status =
      firstBoard &&
      evaluateMagicSquareLine(firstBoard.puzzleState, { kind: "row", index: 0 })
        .status;

    expect(status).toBe("unmatched");
  });
});

describe("ゴールの盤面", () => {
  test("答えが、問題集から除く 4×4 の例の魔方陣と同じこと", () => {
    expect(goalBoard.answer.cells).toEqual(magicSquareExampleSquares[4]);
  });

  test("最初から置いてある数が、答えのただ1つの解になること", () => {
    const { count, solutions } = countMagicSquareSolutions(
      goalBoard.givens.size,
      toGrid(goalBoard.givens.cells),
      { limit: 2, collect: true },
    );

    expect(count).toBe(1);
    expect(solutions[0]).toEqual(goalBoard.answer.cells);
  });

  test("最初から置いてある数の並びが、問題集のどの問題ともチュートリアルの盤面とも違うこと", () => {
    const shownProblems = [
      ...difficultyLevels.flatMap(({ id: level }) =>
        listMagicSquarePoolEntries(level).map(
          (entry) => restoreMagicSquarePoolEntry(entry).problem.givens,
        ),
      ),
      magicSquareTutorialPuzzle.givens,
    ];

    const sameAsShown = shownProblems.some(
      (givens) =>
        givens.size === goalBoard.givens.size &&
        givens.cells.every(
          (cell, index) => cell === goalBoard.givens.cells[index],
        ),
    );

    expect(sameAsShown).toBe(false);
  });

  test("埋めていく順が、空いたマスをどれも1回ずつ、1マスだけ空いた列から埋めること", () => {
    const order = listMagicSquareReadingOrder(goalBoard.givens);
    const emptyCells = goalBoard.givens.cells.flatMap((cell, cellIndex) =>
      cell === null ? [cellIndex] : [],
    );

    expect([...order].sort((left, right) => left - right)).toEqual(emptyCells);
  });
});

describe("置き直しの数え方の流れ", () => {
  test.each([
    { name: "changed", flow: correctionCountFlows.changed, count: 1 },
    { name: "mistyped", flow: correctionCountFlows.mistyped, count: 0 },
  ])(
    "$name は、置いた数で行の端の数の色が変わり、直すと合計にそろい、本番の数え方で $count 回と数えること",
    ({ flow, count }) => {
      const statuses = flow.frames.map(
        (session) =>
          evaluateMagicSquareLine(session.puzzleState, {
            kind: "row",
            index: 0,
          }).status,
      );

      expect(statuses).toEqual(["incomplete", "unmatched", "matched"]);
      expect(flow.correctionCount).toBe(count);
    },
  );
});
