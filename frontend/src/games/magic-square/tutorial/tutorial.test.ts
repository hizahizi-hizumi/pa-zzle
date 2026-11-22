import {
  getMagicSquareLineCellIndices,
  type MagicSquareBoard,
} from "@/games/magic-square/puzzle/board";
import {
  isMagicSquareLineViolation,
  isMagicSquareSolved,
  listMagicSquareLineEvaluations,
  listMagicSquareValueStates,
} from "@/games/magic-square/puzzle/rules";
import {
  _private,
  describeMagicSquareTutorialSelection,
  findMagicSquareTutorialDecidingLine,
  findMagicSquareTutorialHint,
  getMagicSquareTutorialEntryRefusal,
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

/** 空いたマスのうち、手に入れたルールの列で数が決まるマス。 */
function listDecidedCellIndices(
  board: MagicSquareBoard,
  earnedRuleIds: readonly MagicSquareTutorialRuleId[] = allRuleIds,
): number[] {
  return board.cells.flatMap((_, cellIndex) =>
    findMagicSquareTutorialDecidingLine(board, earnedRuleIds, cellIndex) ===
    null
      ? []
      : [cellIndex],
  );
}

/** 探す手順で入れるマス。手順の前の盤面で、空いたマスが1つだけ残った列のマスのうち最初のもの。 */
function findSearchCellIndex(board: MagicSquareBoard): number {
  return listDecidedCellIndices(board)[0] ?? -1;
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

/** 手に入れたルールの列だけで、空いたマスが1つだけ残った列を埋め続けたときの盤面。 */
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

  test("探す手順では、空いたマスが1つだけ残った列のマスが2つ以上あり、入れるマスを自分で選べること", () => {
    const search = ruleAndReadingMoves.at(-1);
    const board = search?.before.boardState.puzzleState ?? givens;

    expect(listDecidedCellIndices(board).length).toBeGreaterThanOrEqual(2);
  });

  test("ルールを伝える手順では、印のマスに置ける数が2つ以上あり、答えのほかはどれも違反になること", () => {
    const choices = ruleAndReadingMoves.flatMap(
      ({ step, before, cellIndex }) => {
        if (step.kind !== "line") {
          return [];
        }
        const selected = perform([{ type: "select", cellIndex }], before);
        const values = listMagicSquareValueStates(
          givens,
          selected.boardState.puzzleState,
          cellIndex,
        ).flatMap((state, index) => (state === "available" ? [index + 1] : []));
        const others = values.filter(
          (value) => value !== solutionValue(cellIndex),
        );
        return [
          {
            choices: values.length >= 2,
            othersViolate: others.every(
              (value) => perform([{ type: "enter", value }], selected).violated,
            ),
          },
        ];
      },
    );

    expect(choices).toEqual([
      { choices: true, othersViolate: true },
      { choices: true, othersViolate: true },
      { choices: true, othersViolate: true },
    ]);
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
  const searchMove = guidedMoves.moves.at(-1);
  const searchBefore = searchMove?.before ?? freePlay;
  /** 探す手順でどのマスを選んでも、手を離した後の盤面。 */
  const freePlayBySearchCell = listDecidedCellIndices(
    searchBefore.boardState.puzzleState,
  ).map((cellIndex) => {
    const progress = perform(placeActions(cellIndex), searchBefore);
    return {
      cellIndex,
      stepIndex: progress.stepIndex,
      ...fillByEarnedLines(
        progress.boardState.puzzleState,
        progress.earnedRuleIds,
      ),
    };
  });

  test("探す手順でどのマスを選んでも、手を離すこと", () => {
    const stepIndices = freePlayBySearchCell.map(({ stepIndex }) => stepIndex);

    expect(stepIndices).toEqual(freePlayBySearchCell.map(() => steps.length));
  });

  test("探す手順でどのマスを選んでも、空いたマスが1つだけ残った列を埋め続けるだけで解き切れること", () => {
    const solved = freePlayBySearchCell.map(({ board }) =>
      isMagicSquareSolved(board),
    );

    expect(solved).toEqual(freePlayBySearchCell.map(() => true));
  });

  test("探す手順でどのマスを選んでも、空いたマスが1つだけ残った列を探す読みが、もう一度以上要ること", () => {
    const moveCounts = freePlayBySearchCell.map(({ moveCount }) => moveCount);

    expect(moveCounts.every((count) => count >= 2)).toBe(true);
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
        "印の付いたマスを選んで印の無い数を押す",
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

    test("空いたマスが2つ以上の列だけを通るマスには数を入れず、そのことを一言で返すこと", () => {
      const progress = perform(
        [{ type: "enter", value: solutionValue(undecided ?? -1) }],
        undecidedSelected,
      );
      const refusal = getMagicSquareTutorialEntryRefusal(
        getTutorialSituation(magicSquareTutorial, undecidedSelected),
        undecidedSelected.boardState,
      );

      expect({ unchanged: progress === undecidedSelected, refusal }).toEqual({
        unchanged: true,
        refusal: "undecided",
      });
    });

    test("空いたマスが2つ以上の列だけを通るマスを選ぶと、そのことと探し方を言うこと", () => {
      const message = describeMagicSquareTutorialSelection(
        getTutorialSituation(magicSquareTutorial, undecidedSelected),
        undecidedSelected.boardState,
      );

      expect(message).toEqual({
        headline: "選んだマスの横の列と縦の列には\n空いたマスが2つ以上あります",
        detail: "空いたマスが1つだけ残った列を探します",
      });
    });

    const filledCases = [
      [
        "最初から置いてある数",
        cellAt(1, 2),
        "選んだマスには最初から数が入っています",
      ],
      ["置いた数", cellAt(1, 1), "選んだマスにはもう数が入っています"],
    ] as const;

    test.each(filledCases)(
      "%sのマスも選べて、そのことと探し方を言うこと",
      (_, cellIndex, headline) => {
        const selected = perform([{ type: "select", cellIndex }], search);
        const message = describeMagicSquareTutorialSelection(
          getTutorialSituation(magicSquareTutorial, selected),
          selected.boardState,
        );

        expect({
          selected: selected.boardState.selectedCellIndex,
          message,
        }).toEqual({
          selected: cellIndex,
          message: {
            headline,
            detail: "空いたマスが1つだけ残った列を探します",
          },
        });
      },
    );

    test("最初から置いてある数のマスに数を押すと、本番と同じく受け付けないこと", () => {
      const selected = perform(
        [{ type: "select", cellIndex: cellAt(1, 2) }],
        search,
      );
      const progress = perform([{ type: "enter", value: 1 }], selected);
      const refusal = getMagicSquareTutorialEntryRefusal(
        getTutorialSituation(magicSquareTutorial, selected),
        selected.boardState,
      );

      expect({ unchanged: progress === selected, refusal }).toEqual({
        unchanged: true,
        refusal: "rejected",
      });
    });

    test("マスを選ばずに数を押すと、本番と同じく受け付けないこと", () => {
      const refusal = getMagicSquareTutorialEntryRefusal(
        getTutorialSituation(magicSquareTutorial, search),
        search.boardState,
      );

      expect(refusal).toBe("rejected");
    });

    test("置いた数のマスで同じ数を押すと、本番と同じく外すこと", () => {
      const progress = perform(placeActions(cellAt(1, 1)), search);

      expect(progress.boardState.puzzleState.cells[cellAt(1, 1)]).toBeNull();
    });
  });

  describe("印のある手順で受け付けなかった数の場合", () => {
    test.each([
      ["操作を教える手順", start],
      ["ルールを伝える手順", rowStep],
    ])("%sでは、印を濃くし直すこと", (_, progress) => {
      const refusal = getMagicSquareTutorialEntryRefusal(
        getTutorialSituation(magicSquareTutorial, progress),
        progress.boardState,
      );

      expect(refusal).toBe("recall");
    });
  });

  describe("違反を言う場合", () => {
    const columnStep = guidedMoves.moves[2]?.before ?? start;
    const diagonalStep = guidedMoves.moves[3]?.before ?? start;
    const cases = [
      [
        "縦の列の手順で、横の列にも違反が出た",
        columnStep,
        [3, 1, 10],
        "この縦の列は合計が34になっていません",
      ],
      [
        "斜めの列の手順で、横の列にも違反が出た",
        diagonalStep,
        [2, 2, 15],
        "この斜めの列は合計が34になっていません",
      ],
      [
        "手を離した後に、横の列と縦の列が同じ違反になった",
        freePlay,
        [3, 4, 10],
        "この横の列と縦の列は合計が34になっていません",
      ],
    ] as const;

    test.each(cases)(
      "%sときは、覆いから抜いた列か、同じ違反の列を全部言うこと",
      (_, before, [row, column, value], headline) => {
        const progress = perform(
          [
            { type: "select", cellIndex: cellAt(row, column) },
            { type: "enter", value },
          ],
          before,
        );
        const message = magicSquareTutorial.describeViolation(
          getTutorialSituation(magicSquareTutorial, progress),
          progress.boardState,
        );

        expect({
          violated: progress.violated,
          headline: message.headline,
        }).toEqual({
          violated: true,
          headline,
        });
      },
    );
  });
});

describe("findMagicSquareTutorialHint", () => {
  const situation = getTutorialSituation(magicSquareTutorial, freePlay);

  test("空いたマスが1つだけ残った列と、そのマスを示すこと", () => {
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
          headline: "印の付いたマスの数が違います",
          detail: "そのマスを選んで\n別の数を押すと入れ直せます",
        },
      });
    });
  });
});
