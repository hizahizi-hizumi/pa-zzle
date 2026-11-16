import {
  parseTakuzuBoard,
  type TakuzuBoard,
  type TakuzuCell,
} from "@/games/takuzu/puzzle/board";
import {
  findTakuzuRuleViolations,
  hasTakuzuRuleViolation,
  isTakuzuSolved,
} from "@/games/takuzu/puzzle/rules";
import {
  _private,
  describeTakuzuTutorialMidwayViolation,
  describeTakuzuTutorialRule,
  describeTakuzuTutorialStep,
  findTakuzuTutorialHint,
  getTakuzuTutorialCellViews,
  getTakuzuTutorialLineViolations,
  getTakuzuTutorialProgressRatio,
  getTakuzuTutorialStepCellIndices,
  getTakuzuTutorialStepReasonCellIndices,
  TAKUZU_TUTORIAL_PROGRESS_STEP_COUNT,
  type TakuzuTutorialAction,
  type TakuzuTutorialBoardState,
  type TakuzuTutorialLesson,
  type TakuzuTutorialRuleId,
  type TakuzuTutorialStep,
  takuzuTutorial,
} from "@/games/takuzu/tutorial/tutorial";
import {
  finishTutorialIntro,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

const { givens, solution, deduceCell, listLessons, findVisibleViolations } =
  _private;

type Progress = TutorialProgress<
  TakuzuTutorialRuleId,
  TakuzuTutorialBoardState
>;

const allLessons = listLessons(["run", "count", "duplicate"]);

function cellAt(row: number, column: number): number {
  return (row - 1) * solution.size + (column - 1);
}

/** 1始まりの行の4マス。 */
function rowCells(row: number): number[] {
  return [1, 2, 3, 4].map((column) => cellAt(row, column));
}

/** 1始まりの列の4マス。 */
function columnCells(column: number): number[] {
  return [1, 2, 3, 4].map((row) => cellAt(row, column));
}

function place(cellIndex: number, cell: TakuzuCell): TakuzuTutorialAction {
  return { type: "place", cellIndex, cell };
}

function tap(cellIndex: number): TakuzuTutorialAction {
  return { type: "cycle", cellIndex, direction: "forward" };
}

function performAll(
  progress: Progress,
  actions: readonly TakuzuTutorialAction[],
): Progress {
  return actions.reduce(
    (current, action) => performTutorialAction(takuzuTutorial, current, action),
    progress,
  );
}

function placeSolution(cellIndices: readonly number[]) {
  return cellIndices.map((cellIndex) =>
    place(cellIndex, solution.cells[cellIndex] ?? null),
  );
}

function finishSteps(count: number): Progress {
  return takuzuTutorial.steps
    .slice(0, count)
    .reduce(
      (progress, step) => performAll(progress, placeSolution(step.cellIndices)),
      finishTutorialIntro(startTutorial(takuzuTutorial)),
    );
}

function getEmptyCellIndices(board: TakuzuBoard): number[] {
  return board.cells.flatMap((cell, index) => (cell === null ? [index] : []));
}

function withCell(
  board: TakuzuBoard,
  cellIndex: number,
  cell: TakuzuCell,
): TakuzuBoard {
  return {
    ...board,
    cells: board.cells.map((current, index) =>
      index === cellIndex ? cell : current,
    ),
  };
}

/** 空きマスをすべての組み合わせで埋め、3つのルールに合う埋め方を返す。 */
function listSolutions(board: TakuzuBoard): string[] {
  const emptyCellIndices = getEmptyCellIndices(board);
  return Array.from(
    { length: 2 ** emptyCellIndices.length },
    function fill(_, pattern) {
      const cells = [...board.cells];
      emptyCellIndices.forEach((cellIndex, bit) => {
        cells[cellIndex] = (pattern >> bit) & 1 ? "b" : "a";
      });
      return { ...board, cells };
    },
  )
    .filter(
      (filled) => !hasTakuzuRuleViolation(findTakuzuRuleViolations(filled)),
    )
    .map((filled) => filled.cells.join(""));
}

function listUnsolvedConsistentBoards(): TakuzuBoard[] {
  const freeCellIndices = getEmptyCellIndices(givens);
  const choices = [null, "a", "b"] as const satisfies readonly TakuzuCell[];
  function extend(board: TakuzuBoard, position: number): TakuzuBoard[] {
    // タイルを足してもルールに合わないところは消えないので、合わなくなった所で先を数えない。
    if (hasTakuzuRuleViolation(findTakuzuRuleViolations(board))) {
      return [];
    }
    const cellIndex = freeCellIndices[position];
    if (cellIndex === undefined) {
      return isTakuzuSolved(board) ? [] : [board];
    }
    return choices.flatMap((choice) =>
      extend(withCell(board, cellIndex, choice), position + 1),
    );
  }
  return extend(givens, 0);
}

function fillByDeduction(
  board: TakuzuBoard,
  lessons: readonly TakuzuTutorialLesson[],
): TakuzuCell[] {
  const cells = [...board.cells];
  for (;;) {
    const current = { ...board, cells };
    const deduced = cells
      .map((_, cellIndex) => ({
        cellIndex,
        deduction: deduceCell(current, lessons, cellIndex),
      }))
      .find(({ deduction }) => deduction !== null);
    if (!deduced?.deduction) {
      return cells;
    }
    cells[deduced.cellIndex] = deduced.deduction.tile;
  }
}

function listTaughtLessons(stepCount: number): TakuzuTutorialLesson[] {
  return takuzuTutorial.steps
    .slice(0, stepCount)
    .flatMap((taught) => (taught.lesson ? [taught.lesson] : []));
}

/** ルールを伝える手順ごとの、始めた盤面、使わせる見方、前の手順までに使わせた見方、印のマスの解。 */
const lessonStepCases = takuzuTutorial.steps.flatMap(
  function createLessonStepCase(step, stepIndex) {
    return step.lesson
      ? [
          [
            stepIndex,
            {
              step,
              board: finishSteps(stepIndex).boardState.board,
              lesson: step.lesson,
              earlierLessons: listTaughtLessons(stepIndex),
              expected: step.cellIndices.map(
                (cellIndex) => solution.cells[cellIndex] ?? null,
              ),
            },
          ] as const,
        ]
      : [];
  },
);

/**
 * 丸はタップで空き→四角→丸と入れるので、丸を入れる印のマスは途中で四角になる。
 * 手順ごとに、印のマスの1つを途中の四角にした盤面（ほかの印のマスは空きのままと、解を置いた後の両方）と、その手順でもまだ伝えていない見方。
 * ルールは行と列に分けて伝えるので、まだ伝えていない向き（行・列）も、まだ伝えていない見方に数える。
 * 3つ続かないことを教える手順の、同じ向きの個数超過は除く。4マスの並びでは、3つ続けば必ず個数も超えるため。
 */
const towardCircleCases = takuzuTutorial.steps.flatMap(
  function createTowardCircleCases(step, stepIndex) {
    const taughtLessons = listTaughtLessons(stepIndex + 1);
    const untaughtLessons = allLessons.filter(
      (lesson) =>
        !taughtLessons.some(
          (taught) =>
            taught.ruleId === lesson.ruleId && taught.axis === lesson.axis,
        ) &&
        !(
          step.lesson?.ruleId === "run" &&
          lesson.ruleId === "count" &&
          lesson.axis === step.lesson.axis
        ),
    );
    const startBoard = finishSteps(stepIndex).boardState.board;
    const othersPlaced = step.cellIndices.reduce(
      (board, cellIndex) =>
        withCell(board, cellIndex, solution.cells[cellIndex] ?? null),
      startBoard,
    );
    return step.cellIndices
      .filter((cellIndex) => solution.cells[cellIndex] === "b")
      .flatMap((cellIndex) =>
        [startBoard, othersPlaced].map(
          (board) =>
            [
              stepIndex,
              cellIndex,
              { board: withCell(board, cellIndex, "a"), untaughtLessons },
            ] as const,
        ),
      );
  },
);

/** 列の4マスが、盤面で3つ続くマスとして示されているか。 */
function getColumnRunFlags(progress: Progress, column: number): boolean[] {
  const cellViews = getTakuzuTutorialCellViews(
    getTutorialSituation(takuzuTutorial, progress),
    progress.boardState,
  );
  return columnCells(column).map(
    (cellIndex) => cellViews[cellIndex]?.inViolatingRun ?? false,
  );
}

/**
 * 1マスずつ打たせるルールの手順ごとの、手順のマスに四角を置いた盤面と、その手順で使わせる見方。
 * 考えずに1回押すと、教えているルールの違反を自分の手で見ることになる。
 */
const squareViolationCases = takuzuTutorial.steps.flatMap(
  function createSquareViolationCases(step, stepIndex) {
    const { lesson } = step;
    if (!lesson || lesson.ruleId === "duplicate") {
      return [];
    }
    const startBoard = finishSteps(stepIndex).boardState.board;
    return step.cellIndices.map(
      (cellIndex) =>
        [
          stepIndex,
          { board: withCell(startBoard, cellIndex, "a"), lesson },
        ] as const,
    );
  },
);

const duplicateStepIndex = takuzuTutorial.steps.findIndex(
  (step) => step.lesson?.ruleId === "duplicate",
);
const duplicateLesson = { ruleId: "duplicate", axis: "row" } as const;
const sameAsAboveBoard = [cellAt(3, 1), cellAt(3, 4)].reduce(
  (board, cellIndex) =>
    withCell(board, cellIndex, solution.cells[cellIndex] === "a" ? "b" : "a"),
  finishSteps(duplicateStepIndex).boardState.board,
);

describe("takuzuTutorial の盤面", () => {
  const releasedBoard = finishSteps(takuzuTutorial.steps.length).boardState
    .board;

  test("解は3つのルールに合い、最初のタイルを含むこと", () => {
    const violations = findTakuzuRuleViolations(solution);
    const changedGivens = givens.cells.filter(
      (cell, index) => cell !== null && cell !== solution.cells[index],
    );

    expect(hasTakuzuRuleViolation(violations)).toBe(false);
    expect(changedGivens).toEqual([]);
  });

  test("最初のタイルだけで、3つのルールに合う埋め方が解だけになること", () => {
    const result = listSolutions(givens);

    expect(result).toEqual([solution.cells.join("")]);
  });

  test("入口で見せる解き終えた盤面は、解であること", () => {
    const result = takuzuTutorial.goal().board;

    expect(result).toEqual(solution);
  });

  test("操作を教える手順は、2回タップして入れる丸を、解のとおりに置かせること", () => {
    const result = takuzuTutorial.steps
      .filter((step) => step.lesson === null)
      .map((step) => step.cellIndices.map((index) => solution.cells[index]));

    expect(result).toEqual([["b"]]);
  });

  test("ルールを伝える手順は、伝えるルールで決まるマスを打たせ、3つのルールをこの順に1つずつ伝えること", () => {
    const introduced = takuzuTutorial.steps.flatMap(
      (step) => step.introducedRuleId ?? [],
    );
    const lessonRules = takuzuTutorial.steps.flatMap(
      (step) => step.lesson?.ruleId ?? [],
    );

    expect(introduced).toEqual(takuzuTutorial.rules.map((rule) => rule.id));
    expect(lessonRules).toEqual(introduced);
  });

  test.each(lessonStepCases)(
    "手順 %i の印のマスは、その手順で使わせる見方で決まり、前の手順までに使わせた見方では決まらないこと",
    (_, { step, board, lesson, earlierLessons, expected }) => {
      const byLesson = step.cellIndices.map(
        (cellIndex) => deduceCell(board, [lesson], cellIndex)?.tile ?? null,
      );
      const byEarlier = step.cellIndices.map((cellIndex) =>
        deduceCell(board, earlierLessons, cellIndex),
      );

      expect(byLesson).toEqual(expected);
      expect(byEarlier).toEqual(step.cellIndices.map(() => null));
    },
  );

  test.each(lessonStepCases)(
    "手順 %i の最初の印のマスに解を置くと、その手順で使わせる見方の決め手を示すこと",
    (stepIndex, { step, board, lesson }) => {
      const [cellIndex = -1] = step.cellIndices;
      const progress = performAll(finishSteps(stepIndex), [
        place(cellIndex, solution.cells[cellIndex] ?? null),
      ]);

      const result = progress.boardState.lastMove?.reasonCellIndices;

      expect(result).toEqual(
        deduceCell(board, [lesson], cellIndex)?.reasonCellIndices,
      );
    },
  );

  test.each(towardCircleCases)(
    "手順 %i でマス %i へ丸を入れる途中の盤面は、まだ伝えていないルールにも、まだ伝えていない向きにも当たらないこと",
    (_, __, { board, untaughtLessons }) => {
      const violations = findVisibleViolations(board, untaughtLessons);

      const result = hasTakuzuRuleViolation(violations);

      expect(result).toBe(false);
    },
  );

  test.each(squareViolationCases)(
    "手順 %i で手順のマスに四角を1つ置くと、その手順のルールの違反になること",
    (_, { board, lesson }) => {
      const violations = findVisibleViolations(board, [lesson]);

      const result = hasTakuzuRuleViolation(violations);

      expect(result).toBe(true);
    },
  );

  test("同じ並びの手順で、印のマスを上の行と同じ並びに埋めると、重複の違反になること", () => {
    const violations = findVisibleViolations(sameAsAboveBoard, [
      duplicateLesson,
    ]);

    expect(violations.duplicateLines).toEqual([
      { axis: "row", index: 1 },
      { axis: "row", index: 2 },
    ]);
  });

  test("手順を終えると空きが残り、3つのルールを行と列に当てはめるだけで解き切れること", () => {
    const result = fillByDeduction(releasedBoard, allLessons);

    expect(getEmptyCellIndices(releasedBoard).length).toBeGreaterThan(0);
    expect(result).toEqual(solution.cells);
  });
});

describe("takuzuTutorial.perform", () => {
  const started = finishTutorialIntro(startTutorial(takuzuTutorial));
  const released = finishSteps(takuzuTutorial.steps.length);

  test("手を引いている間は、印の無いマスへの操作で盤面を変えないこと", () => {
    const result = performAll(started, [tap(cellAt(1, 1)), tap(cellAt(4, 3))]);

    expect(result).toBe(started);
  });

  test("固定マスへの操作で盤面を変えないこと", () => {
    const result = performAll(released, [tap(cellAt(2, 1))]);

    expect(result).toBe(released);
  });

  test("操作の手順のマスは、1回タップした四角では進まず、2回タップして丸にすると次の手順へ進むこと", () => {
    const once = performAll(started, [tap(cellAt(4, 1))]);
    const twice = performAll(once, [tap(cellAt(4, 1))]);

    expect(once.boardState.board.cells[cellAt(4, 1)]).toBe("a");
    expect(once.violated).toBe(false);
    expect(once.stepIndex).toBe(0);
    expect(twice.boardState.board.cells[cellAt(4, 1)]).toBe("b");
    expect(twice.stepIndex).toBe(1);
  });

  describe("3つ続かないことを示す手順で", () => {
    const runStep = finishSteps(1);

    test("キーで四角を置くと、ルールに合わないとして進まず、縦に3つ続くマスを示すこと", () => {
      const result = performAll(runStep, [place(cellAt(1, 3), "a")]);

      expect(result.violated).toBe(true);
      expect(result.stepIndex).toBe(1);
      expect(getColumnRunFlags(result, 3)).toEqual([true, true, true, false]);
    });

    test("2回タップして丸にすると、縦に並んだ2つの四角を決め手にして次の手順へ進むこと", () => {
      const result = performAll(runStep, [
        tap(cellAt(1, 3)),
        tap(cellAt(1, 3)),
      ]);

      expect(result.violated).toBe(false);
      expect(result.stepIndex).toBe(2);
      expect(result.boardState.lastMove?.reasonCellIndices).toEqual([
        cellAt(2, 3),
        cellAt(3, 3),
      ]);
    });
  });

  describe("同じ数ずつ入ることを示す手順で", () => {
    const countStep = finishSteps(2);

    test("解のタイルを置くと、その行にもう入っているタイルすべてを決め手にすること", () => {
      const result = performAll(countStep, placeSolution([cellAt(2, 4)]));

      expect(result.stepIndex).toBe(3);
      expect(result.boardState.lastMove?.reasonCellIndices).toEqual([
        cellAt(2, 1),
        cellAt(2, 2),
        cellAt(2, 3),
      ]);
    });
  });

  describe("同じ並びを示す手順で", () => {
    const duplicateStepIndex = takuzuTutorial.steps.length - 1;
    const duplicateStep = finishSteps(duplicateStepIndex);
    const sameAsAbove = performAll(duplicateStep, [
      place(cellAt(3, 1), "a"),
      place(cellAt(3, 4), "b"),
    ]);
    const reasonsAtStart = getTakuzuTutorialStepReasonCellIndices(
      getTutorialSituation(takuzuTutorial, duplicateStep),
      duplicateStep.boardState,
    );

    test("印のマスの決め手は、見比べる上の行と、同じ行にもう入っているタイルであること", () => {
      const result = [...reasonsAtStart].sort((left, right) => left - right);

      expect(result).toEqual([...rowCells(2), cellAt(3, 2), cellAt(3, 3)]);
    });

    describe("片方の印のマスに解を置いた場合", () => {
      const halfDone = performAll(duplicateStep, placeSolution([cellAt(3, 4)]));

      test("進まず、もう片方に印を付け続けること", () => {
        const stepCellIndices = getTakuzuTutorialStepCellIndices(
          getTutorialSituation(takuzuTutorial, halfDone),
          halfDone.boardState,
        );

        expect(halfDone.stepIndex).toBe(duplicateStepIndex);
        expect(stepCellIndices).toEqual([cellAt(3, 1)]);
      });

      test("印のマスの決め手を、手順を始めたときから替えないこと", () => {
        const result = getTakuzuTutorialStepReasonCellIndices(
          getTutorialSituation(takuzuTutorial, halfDone),
          halfDone.boardState,
        );

        expect(result).toEqual(reasonsAtStart);
      });

      test("もう片方へ丸に向かう途中の四角では、ルールに合わないところを見せず、手が止まったら四角が多すぎる行を示すこと", () => {
        const result = performAll(halfDone, [tap(cellAt(3, 1))]);
        const situation = getTutorialSituation(takuzuTutorial, result);
        const shownRightAway = getTakuzuTutorialLineViolations(
          situation,
          result.boardState,
        );
        const shownWhenSettled = getTakuzuTutorialLineViolations(
          situation,
          result.boardState,
          true,
        );

        expect(result.violated).toBe(false);
        expect(result.stepIndex).toBe(duplicateStepIndex);
        expect(shownRightAway).toEqual([]);
        expect(shownWhenSettled).toEqual([
          { axis: "row", index: 2, overfilled: true, duplicated: false },
        ]);
      });
    });

    describe("片方の印のマスに解と違うタイルを置いた場合", () => {
      const mistaken = performAll(duplicateStep, [place(cellAt(3, 1), "a")]);

      test("印のマスの決め手を、違うタイルを前提にせず、手順を始めたときから替えないこと", () => {
        const result = getTakuzuTutorialStepReasonCellIndices(
          getTutorialSituation(takuzuTutorial, mistaken),
          mistaken.boardState,
        );

        expect(result).toEqual(reasonsAtStart);
      });

      test("もう片方にも解と違うタイルを置くと、その手に決め手を付けないこと", () => {
        const result = performAll(mistaken, [place(cellAt(3, 4), "b")]);

        expect(result.boardState.lastMove?.reasonCellIndices).toEqual([]);
      });
    });

    test("上の行と同じ並びにすると、ルールに合わないとして重なった行を示すこと", () => {
      const lineViolations = getTakuzuTutorialLineViolations(
        getTutorialSituation(takuzuTutorial, sameAsAbove),
        sameAsAbove.boardState,
      );

      expect(sameAsAbove.violated).toBe(true);
      expect(lineViolations).toEqual([
        { axis: "row", index: 1, overfilled: false, duplicated: true },
        { axis: "row", index: 2, overfilled: false, duplicated: true },
      ]);
    });

    test("同じ並びから1マスだけ解のタイルに直しても、もう片方のせいで多すぎるなら、ルールに合わないとして示すこと", () => {
      const result = performAll(sameAsAbove, [tap(cellAt(3, 1))]);
      const lineViolations = getTakuzuTutorialLineViolations(
        getTutorialSituation(takuzuTutorial, result),
        result.boardState,
      );

      expect(result.boardState.board.cells[cellAt(3, 1)]).toBe("b");
      expect(result.violated).toBe(true);
      expect(lineViolations).toEqual([
        { axis: "row", index: 2, overfilled: true, duplicated: false },
      ]);
    });
  });

  describe("手順を終えた後", () => {
    const [emptyCellIndex = -1] = getEmptyCellIndices(
      released.boardState.board,
    );
    const situation = getTutorialSituation(takuzuTutorial, released);

    test("手を離し、上と下の行に残った5マスのどれにも置けること", () => {
      const result = performAll(released, [tap(emptyCellIndex)]);

      expect(situation.step).toBeNull();
      expect(getEmptyCellIndices(released.boardState.board)).toEqual([
        cellAt(1, 1),
        cellAt(1, 2),
        cellAt(1, 4),
        cellAt(4, 2),
        cellAt(4, 3),
      ]);
      expect(result.boardState.board.cells[emptyCellIndex]).toBe("a");
    });

    test("ルールに合わないところが無く解けていないどの盤面でも、手がかりを示し、ルールで決まる空きマスがあればそれをそのルールと決め手とともに示して、置いたタイルの正誤を明かさないこと", () => {
      const strayHints = listUnsolvedConsistentBoards().filter((board) => {
        const hint = findTakuzuTutorialHint(situation, {
          board,
          moveCount: 0,
          lastMove: null,
        });
        if (hint === null) {
          return true;
        }
        const deducible = board.cells.some(
          (_, index) => deduceCell(board, allLessons, index) !== null,
        );
        if (!deducible) {
          return false;
        }
        const deduction =
          hint.ruleId === null
            ? null
            : deduceCell(board, listLessons([hint.ruleId]), hint.cellIndex);
        return (
          deduction === null ||
          deduction.reasonCellIndices.join() !== hint.reasonCellIndices.join()
        );
      });

      expect(strayHints).toEqual([]);
    });

    describe("並んだ2つの隣で決まるマスと、挟まれて決まるマスがある場合", () => {
      const board = parseTakuzuBoard(["A.A.", "....", "....", ".BB."]);

      test("盤面で先にある挟まれたマスより、並んだ2つの隣で決まるマスを先に示すこと", () => {
        const result = findTakuzuTutorialHint(situation, {
          board,
          moveCount: 0,
          lastMove: null,
        });

        expect(result).toEqual({
          cellIndex: cellAt(4, 1),
          reasonCellIndices: [cellAt(4, 2), cellAt(4, 3)],
          ruleId: "run",
        });
      });
    });

    describe("ルールだけで決まるマスが無く、解と違うタイルがある場合", () => {
      const mistakenCellIndex = cellAt(3, 1);
      const mistakenBoard = withCell(solution, mistakenCellIndex, "a");

      test("そのタイルのマスを、ルールも決め手も添えずに示すこと", () => {
        const result = findTakuzuTutorialHint(situation, {
          board: mistakenBoard,
          moveCount: 0,
          lastMove: null,
        });

        expect(result).toEqual({
          cellIndex: mistakenCellIndex,
          reasonCellIndices: [],
          ruleId: null,
        });
      });
    });

    test("残りを解のとおりに埋めると解けること", () => {
      const result = performAll(
        released,
        placeSolution(getEmptyCellIndices(released.boardState.board)),
      );

      expect(result.phase).toBe("solved");
    });
  });
});

describe("takuzuTutorial.describeViolation", () => {
  const cases = [
    [
      "四角が縦に3つ続いた",
      1,
      [place(cellAt(1, 3), "a")],
      {
        headline: "四角が3つ続いています",
        detail: "もう一度タップすると丸に変わります",
      },
    ],
    [
      "四角が多すぎる行ができた",
      2,
      [place(cellAt(2, 4), "a")],
      {
        headline: "この行は四角が多すぎます",
        detail: "もう一度タップすると丸に変わります",
      },
    ],
    [
      "上の行と同じ並びにした",
      takuzuTutorial.steps.length - 1,
      [place(cellAt(3, 1), "a"), place(cellAt(3, 4), "b")],
      {
        headline: "上の行と同じ並びになっています",
        detail: "印の2マスの形を入れ替えます",
      },
    ],
    [
      "解と違うタイルが、直前に置いたマスとは別のマスにある",
      takuzuTutorial.steps.length - 1,
      [place(cellAt(3, 1), "a"), place(cellAt(3, 4), "a")],
      {
        headline: "この行は四角が多すぎます",
        detail: "印のマスをタップすると丸に変わります",
      },
    ],
    [
      "手を離した後に、丸が多すぎる列ができた",
      takuzuTutorial.steps.length,
      [place(cellAt(1, 1), "b")],
      {
        headline: "この列は丸が多すぎます",
        detail: "あと2回タップすると四角に変わります",
      },
    ],
  ] as const;

  const progressCases = cases.map(
    ([name, stepIndex, actions, expected]) =>
      [name, performAll(finishSteps(stepIndex), actions), expected] as const,
  );

  test.each(progressCases)(
    "当たったルールを具体的に言い、直し方を添えること: %s",
    (_, progress, expected) => {
      const result = takuzuTutorial.describeViolation(
        getTutorialSituation(takuzuTutorial, progress),
        progress.boardState,
      );

      expect(progress.violated).toBe(true);
      expect(result).toEqual(expected);
    },
  );
});

describe("describeTakuzuTutorialMidwayViolation", () => {
  const cases = [
    [
      "3つ続かない手順のマスを1回タップした",
      1,
      cellAt(1, 3),
      {
        headline: "四角が3つ続いています",
        detail: "もう一度タップすると丸に変わります",
      },
    ],
    [
      "同じ数の手順のマスを1回タップした",
      2,
      cellAt(2, 4),
      {
        headline: "この行は四角が多すぎます",
        detail: "もう一度タップすると丸に変わります",
      },
    ],
    ["操作の手順のマスを1回タップした", 0, cellAt(4, 1), null],
  ] as const;

  const progressCases = cases.map(
    ([name, stepIndex, cellIndex, expected]) =>
      [
        name,
        performAll(finishSteps(stepIndex), [tap(cellIndex)]),
        expected,
      ] as const,
  );

  test.each(progressCases)(
    "途中の四角が当たっているルールを言い、当たっていなければ null を返すこと: %s",
    (_, progress, expected) => {
      const result = describeTakuzuTutorialMidwayViolation(
        getTutorialSituation(takuzuTutorial, progress),
        progress.boardState,
      );

      expect(progress.violated).toBe(false);
      expect(result).toEqual(expected);
    },
  );
});

function getStep(stepIndex: number): TakuzuTutorialStep {
  const step = takuzuTutorial.steps[stepIndex];
  if (!step) {
    throw new Error(`手順 ${stepIndex} がありません`);
  }
  return step;
}

describe("describeTakuzuTutorialStep", () => {
  const operationStep = getStep(0);
  const runStep = getStep(1);
  const operationCellIndex = cellAt(4, 1);
  const runCellIndex = cellAt(1, 3);
  const cases = [
    ["印のマスが空き", operationStep, operationCellIndex, null, "message"],
    [
      "印のマスに途中の四角を置いた",
      operationStep,
      operationCellIndex,
      "a",
      "midwayMessage",
    ],
    ["印のマスに丸を置いた", operationStep, operationCellIndex, "b", "message"],
    [
      "途中の一言を持たない手順で、印のマスに解と違う四角を置いた",
      runStep,
      runCellIndex,
      "a",
      "message",
    ],
  ] as const;

  test.each(cases)(
    "途中の四角を置いている間だけ、途中の一言にすること: %s",
    (_, step, cellIndex, cell, expectedKey) => {
      const result = describeTakuzuTutorialStep(step, {
        board: withCell(givens, cellIndex, cell),
        moveCount: 0,
        lastMove: null,
      });

      expect(result).toEqual(step[expectedKey]);
    },
  );
});

describe("describeTakuzuTutorialRule", () => {
  const cases = takuzuTutorial.rules.map((rule) => {
    const step = takuzuTutorial.steps.find(
      (candidate) => candidate.introducedRuleId === rule.id,
    );
    return [rule.id, step?.message.detail] as const;
  });

  test.each(cases)(
    "そのルールの一言と、そのルールを伝えた手順の補足を返すこと: %s",
    (ruleId, expected) => {
      const result = describeTakuzuTutorialRule(ruleId);

      expect(result?.detail).toEqual(expected);
    },
  );

  test.each([
    ["run", "同じ形は\n2つまで並べられます"],
    ["count", "全ての行と列は四角と丸が同じ数ずつ入ります"],
    ["duplicate", "全ての行と行、列と列で違う並びにします"],
  ] as const)("そのルールの一言を返すこと: %s", (ruleId, expected) => {
    const result = describeTakuzuTutorialRule(ruleId);

    expect(result?.headline).toBe(expected);
  });
});

describe("getTakuzuTutorialProgressRatio", () => {
  const startState = takuzuTutorial.start();
  const cases = [
    ["始めの盤面", startState, 0],
    [
      "解と同じタイルを1マスに置いた盤面",
      { ...startState, board: withCell(givens, cellAt(1, 1), "a") },
      1 / 10,
    ],
    [
      "解と違うタイルを1マスに置いた盤面",
      { ...startState, board: withCell(givens, cellAt(1, 1), "b") },
      0,
    ],
    ["解き終えた盤面", takuzuTutorial.goal(), 1],
  ] as const;

  test("始めの盤面の空きマスの数を、進み具合の段の数にすること", () => {
    const result = TAKUZU_TUTORIAL_PROGRESS_STEP_COUNT;

    expect(result).toBe(10);
  });

  test.each(cases)(
    "解と同じタイルを置いたマスの割合を返すこと: %s",
    (_, boardState, expected) => {
      const result = getTakuzuTutorialProgressRatio(boardState);

      expect(result).toBe(expected);
    },
  );
});
