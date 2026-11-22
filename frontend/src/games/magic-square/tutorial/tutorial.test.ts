import {
  getMagicSquareLineCellIndices,
  type MagicSquareBoard,
} from "@/games/magic-square/puzzle/board";
import {
  isMagicSquareLineViolation,
  isMagicSquareSolved,
  listMagicSquareLineEvaluations,
} from "@/games/magic-square/puzzle/rules";
import {
  _private,
  describeMagicSquareTutorialSelection,
  findMagicSquareTutorialDecidingLine,
  findMagicSquareTutorialHint,
  listMagicSquareTutorialLineEvaluations,
  type MagicSquareTutorialAction,
  type MagicSquareTutorialBoardState,
  type MagicSquareTutorialRuleId,
  type MagicSquareTutorialStep,
  magicSquareTutorial,
} from "@/games/magic-square/tutorial/tutorial";
import {
  finishTutorialIntro,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

type Progress = TutorialProgress<
  MagicSquareTutorialRuleId,
  MagicSquareTutorialBoardState
>;

const { givens, solution, cellAt } = _private;
const { steps } = magicSquareTutorial;
const allRuleIds: readonly MagicSquareTutorialRuleId[] = [
  "row",
  "column",
  "diagonal",
];

function perform(
  actions: readonly MagicSquareTutorialAction[],
  progress: Progress = finishTutorialIntro(startTutorial(magicSquareTutorial)),
): Progress {
  return actions.reduce(
    (current, action) =>
      performTutorialAction(magicSquareTutorial, current, action),
    progress,
  );
}

function solutionValue(cellIndex: number): number {
  return solution.cells[cellIndex] ?? 0;
}

function placeActions(cellIndex: number): MagicSquareTutorialAction[] {
  return [
    { type: "select", cellIndex },
    { type: "enter", value: solutionValue(cellIndex) },
  ];
}

/** 探す手順で入れるマス。手順の前の盤面で、空いたマスが1つの列のマスのうち最初のもの。 */
function findSearchCellIndex(board: MagicSquareBoard): number {
  return board.cells.findIndex(
    (_, cellIndex) =>
      findMagicSquareTutorialDecidingLine(board, allRuleIds, cellIndex) !==
      null,
  );
}

function getStepCellIndex(
  step: MagicSquareTutorialStep,
  board: MagicSquareBoard,
) {
  return step.kind === "search" ? findSearchCellIndex(board) : step.cellIndex;
}

/** 手順を1つずつ答えの数で終えたときの、各手順の前の盤面と入れたマス。 */
const guidedMoves = steps.reduce<{
  progress: Progress;
  moves: {
    step: MagicSquareTutorialStep;
    before: Progress;
    cellIndex: number;
  }[];
}>(
  ({ progress, moves }, step) => {
    const cellIndex = getStepCellIndex(step, progress.boardState.puzzleState);
    return {
      progress: perform(placeActions(cellIndex), progress),
      moves: [...moves, { step, before: progress, cellIndex }],
    };
  },
  {
    progress: finishTutorialIntro(startTutorial(magicSquareTutorial)),
    moves: [],
  },
);
const freePlay = guidedMoves.progress;

function listEmptyCellIndices(board: MagicSquareBoard): number[] {
  return board.cells.flatMap((cell, cellIndex) =>
    cell === null ? [cellIndex] : [],
  );
}

/** 手に入れたルールの列だけで、空いたマスが1つの列を埋め続けたときの盤面。 */
function fillByEarnedLines(
  board: MagicSquareBoard,
  earnedRuleIds: readonly MagicSquareTutorialRuleId[],
): { board: MagicSquareBoard; moveCount: number } {
  let cells = [...board.cells];
  let moveCount = 0;
  for (;;) {
    const current = { size: board.size, cells };
    const cellIndex = listEmptyCellIndices(current).find(
      (emptyCellIndex) =>
        findMagicSquareTutorialDecidingLine(
          current,
          earnedRuleIds,
          emptyCellIndex,
        ) !== null,
    );
    if (cellIndex === undefined) {
      return { board: current, moveCount };
    }
    cells = cells.map((cell, index) =>
      index === cellIndex ? solutionValue(index) : cell,
    );
    moveCount += 1;
  }
}

describe("盤面", () => {
  const goal = magicSquareTutorial.goal().puzzleState;

  test("解き終えた盤面が魔方陣になっていること", () => {
    const solved = isMagicSquareSolved(goal);

    expect(solved).toBe(true);
  });

  test("始めの盤面は、どの列も空いたマスが2つ以上あること", () => {
    const evaluations = listMagicSquareLineEvaluations(givens);

    expect(evaluations.every(({ emptyCount }) => emptyCount >= 2)).toBe(true);
  });
});

describe("手を引く間", () => {
  const [operation, ...ruleAndReadingMoves] = guidedMoves.moves;

  test("手順どおりに終えると、横・縦・斜めのルールを手に入れて手を離すこと", () => {
    const state = {
      stepIndex: freePlay.stepIndex,
      earnedRuleIds: freePlay.earnedRuleIds,
    };

    expect(state).toEqual({
      stepIndex: steps.length,
      earnedRuleIds: ["row", "column", "diagonal"],
    });
  });

  test("操作を教える手は、解き終えた盤面の数を入れること", () => {
    const step = operation?.step;
    const value = step?.kind === "operation" ? step.value : null;

    expect(value).toBe(solutionValue(operation?.cellIndex ?? -1));
  });

  test("ルールを伝えた後の各手は、それまでに手に入れたルールの列で決まること", () => {
    const decided = ruleAndReadingMoves.map(({ before, cellIndex }) =>
      findMagicSquareTutorialDecidingLine(
        before.boardState.puzzleState,
        getTutorialSituation(magicSquareTutorial, before).earnedRuleIds,
        cellIndex,
      ),
    );

    expect(decided.every((line) => line !== null)).toBe(true);
  });

  test("ルールを伝える手は、伝えた向きの列でだけ決まること", () => {
    const decidingKinds = ruleAndReadingMoves.flatMap(
      ({ step, before, cellIndex }) =>
        step.kind === "line"
          ? [
              {
                introduced: step.introducedRuleId,
                deciding: allRuleIds.filter(
                  (kind) =>
                    findMagicSquareTutorialDecidingLine(
                      before.boardState.puzzleState,
                      [kind],
                      cellIndex,
                    ) !== null,
                ),
              },
            ]
          : [],
    );

    expect(decidingKinds).toEqual([
      { introduced: "row", deciding: ["row"] },
      { introduced: "column", deciding: ["column"] },
      { introduced: "diagonal", deciding: ["diagonal"] },
    ]);
  });

  test("ルールを伝える手順と探す手順では、入れる数を印で示さないこと", () => {
    const kinds = ruleAndReadingMoves.map(({ step }) => step.kind);

    expect(kinds).toEqual(["line", "line", "line", "search"]);
  });

  test("探す手順では、空いたマスが1つの列のマスが2つ以上あること", () => {
    const search = ruleAndReadingMoves.at(-1);
    const board = search?.before.boardState.puzzleState ?? givens;
    const candidates = listEmptyCellIndices(board).filter(
      (cellIndex) =>
        findMagicSquareTutorialDecidingLine(board, allRuleIds, cellIndex) !==
        null,
    );

    expect(candidates.length).toBeGreaterThanOrEqual(2);
  });

  test("手順の途中の盤面に、まだ伝えていない向きの列の違反が無いこと", () => {
    const violations = guidedMoves.moves.flatMap(({ before }) =>
      listMagicSquareLineEvaluations(before.boardState.puzzleState).filter(
        ({ status }) => isMagicSquareLineViolation(status),
      ),
    );

    expect(violations).toEqual([]);
  });
});

describe("手を離した後", () => {
  const { board, moveCount } = fillByEarnedLines(
    freePlay.boardState.puzzleState,
    freePlay.earnedRuleIds,
  );

  test("空いたマスが1つの列を埋め続けるだけで解き切れること", () => {
    const solved = isMagicSquareSolved(board);

    expect(solved).toBe(true);
  });

  test("空いたマスが1つの列を探す読みが、もう一度以上要ること", () => {
    expect(moveCount).toBeGreaterThanOrEqual(2);
  });

  test("残りを答えの数で埋めると解けること", () => {
    const progress = perform(
      listEmptyCellIndices(freePlay.boardState.puzzleState).flatMap(
        placeActions,
      ),
      freePlay,
    );

    expect(progress.phase).toBe("solved");
  });
});

describe("magicSquareTutorial.perform", () => {
  const start = finishTutorialIntro(startTutorial(magicSquareTutorial));
  const operationCellIndex = cellAt(1, 1);
  const rowStep = perform(placeActions(operationCellIndex));
  const rowCellIndex = cellAt(1, 4);
  const rowCellSelected = perform(
    [{ type: "select", cellIndex: rowCellIndex }],
    rowStep,
  );
  const wrongInRow = perform([{ type: "enter", value: 15 }], rowCellSelected);

  describe("操作を教える手順の場合", () => {
    const cases: readonly [string, MagicSquareTutorialAction[]][] = [
      ["印の無いマスを選ぶ", [{ type: "select", cellIndex: cellAt(1, 4) }]],
      ["マスを選ぶ前に数を押す", [{ type: "enter", value: 14 }]],
      [
        "印のマスを選んで印の無い数を押す",
        [
          { type: "select", cellIndex: operationCellIndex },
          { type: "enter", value: 1 },
        ],
      ],
    ];

    test.each(cases)("%s手で盤面を変えないこと", (_, actions) => {
      const progress = perform(actions, start);

      expect(progress.boardState.puzzleState).toBe(
        start.boardState.puzzleState,
      );
    });
  });

  describe("ルールを伝える手順で違う数を入れた場合", () => {
    test("違反にして、その列の名前を言うこと", () => {
      const message = magicSquareTutorial.describeViolation(
        getTutorialSituation(magicSquareTutorial, wrongInRow),
        wrongInRow.boardState,
      );

      expect({ violated: wrongInRow.violated, message }).toEqual({
        violated: true,
        message: {
          headline: "この横の列は合計が34になっていません",
          detail: "別の数を押すと入れ直せます",
        },
      });
    });

    test("まだ伝えていない縦の列の違反は、そろっていない列として見せること", () => {
      const column = listMagicSquareTutorialLineEvaluations(
        getTutorialSituation(magicSquareTutorial, wrongInRow),
        wrongInRow.boardState,
      ).find(({ line }) => line.kind === "column" && line.index === 3);

      expect({ sum: column?.sum, status: column?.status }).toEqual({
        sum: 37,
        status: "incomplete",
      });
    });

    test("答えの数に入れ直すと次の手順へ進むこと", () => {
      const progress = perform(
        [{ type: "enter", value: solutionValue(rowCellIndex) }],
        wrongInRow,
      );

      expect({
        stepIndex: progress.stepIndex,
        violated: progress.violated,
      }).toEqual({ stepIndex: 2, violated: false });
    });
  });

  describe("探す手順の場合", () => {
    const search = guidedMoves.moves.at(-1)?.before ?? start;
    const undecided = listEmptyCellIndices(search.boardState.puzzleState).find(
      (cellIndex) =>
        findMagicSquareTutorialDecidingLine(
          search.boardState.puzzleState,
          allRuleIds,
          cellIndex,
        ) === null,
    );
    const undecidedSelected = perform(
      [{ type: "select", cellIndex: undecided ?? -1 }],
      search,
    );

    test("空いたマスが2つ以上の列だけを通るマスには数を入れられないこと", () => {
      const progress = perform(
        [{ type: "enter", value: solutionValue(undecided ?? -1) }],
        undecidedSelected,
      );

      expect(progress).toBe(undecidedSelected);
    });

    test("空いたマスが2つ以上の列だけを通るマスを選ぶと、そのことと探し方を言うこと", () => {
      const message = describeMagicSquareTutorialSelection(
        getTutorialSituation(magicSquareTutorial, undecidedSelected),
        undecidedSelected.boardState,
      );

      expect(message).toEqual({
        headline: "このマスを通る横の列と縦の列は\n空いたマスが2つ以上あります",
        detail: "空いたマスが1つの列を探します",
      });
    });
  });
});

describe("findMagicSquareTutorialHint", () => {
  const situation = getTutorialSituation(magicSquareTutorial, freePlay);

  test("空いたマスが1つの列と、そのマスを示すこと", () => {
    const hint = findMagicSquareTutorialHint(situation, freePlay.boardState);
    const emptyCells =
      hint?.kind === "line"
        ? getMagicSquareLineCellIndices(givens.size, hint.line).filter(
            (cellIndex) =>
              freePlay.boardState.puzzleState.cells[cellIndex] === null,
          )
        : [];

    expect(emptyCells).toEqual(hint?.kind === "line" ? [hint.cellIndex] : [-1]);
  });

  describe("違う数が入っている場合", () => {
    const freeCellIndex =
      listEmptyCellIndices(freePlay.boardState.puzzleState)[0] ?? -1;
    const wrongValue = listEmptyCellIndices(freePlay.boardState.puzzleState)
      .map(solutionValue)
      .find((value) => value !== solutionValue(freeCellIndex));
    const withWrongValue = perform(
      [
        { type: "select", cellIndex: freeCellIndex },
        { type: "enter", value: wrongValue ?? -1 },
      ],
      freePlay,
    );

    test("違う数のマスを示すこと", () => {
      const hint = findMagicSquareTutorialHint(
        getTutorialSituation(magicSquareTutorial, withWrongValue),
        withWrongValue.boardState,
      );

      expect(hint).toEqual({
        kind: "wrong-value",
        cellIndex: freeCellIndex,
        message: {
          headline: "印のマスの数が違います",
          detail: "印のマスを選んで\n別の数を押すと入れ直せます",
        },
      });
    });
  });
});
