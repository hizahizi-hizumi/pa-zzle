import type { TakuzuBoard, TakuzuCell } from "@/games/takuzu/puzzle/board";
import {
  findTakuzuRuleViolations,
  hasTakuzuRuleViolation,
} from "@/games/takuzu/puzzle/rules";
import {
  _private,
  findTakuzuTutorialHintCellIndex,
  getTakuzuTutorialCellViews,
  getTakuzuTutorialLineViolations,
  getTakuzuTutorialStepCellIndices,
  type TakuzuTutorialAction,
  type TakuzuTutorialBoardState,
  type TakuzuTutorialRuleId,
  takuzuTutorial,
} from "@/games/takuzu/tutorial/tutorial";
import {
  finishTutorialIntro,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

const { givens, solution, deduceCell } = _private;

type Progress = TutorialProgress<
  TakuzuTutorialRuleId,
  TakuzuTutorialBoardState
>;

const allRuleIds = [
  "run",
  "count",
  "duplicate",
] as const satisfies readonly TakuzuTutorialRuleId[];

/** 1始まりの行・列で書いたマス。 */
function cellAt(row: number, column: number): number {
  return (row - 1) * solution.size + (column - 1);
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

/** 最初の `count` 個の手順を、印のマスへ解のタイルを置いて終える。 */
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

/** 決まるマスを、決まらなくなるまで1つずつ埋める。 */
function fillByDeduction(
  board: TakuzuBoard,
  ruleIds: readonly TakuzuTutorialRuleId[],
): TakuzuCell[] {
  const cells = [...board.cells];
  for (;;) {
    const current = { ...board, cells };
    const deduced = cells
      .map((_, cellIndex) => ({
        cellIndex,
        deduction: deduceCell(current, ruleIds, cellIndex),
      }))
      .find(({ deduction }) => deduction !== null);
    if (!deduced?.deduction) {
      return cells;
    }
    cells[deduced.cellIndex] = deduced.deduction.tile;
  }
}

const operationStepCount = takuzuTutorial.steps.findIndex(
  (step) => step.introducedRuleId !== null,
);
/** 手順ごとの、始めた盤面と手に入れたルール、印のマスの解。 */
const ruleStepCases = takuzuTutorial.steps
  .map(function createStepCase(step, stepIndex) {
    const progress = finishSteps(stepIndex);
    return [
      stepIndex,
      {
        step,
        board: progress.boardState.board,
        earnedRuleIds: progress.earnedRuleIds,
        expected: step.cellIndices.map(
          (cellIndex) => solution.cells[cellIndex] ?? null,
        ),
      },
    ] as const;
  })
  .slice(operationStepCount);
const introducingStepCases = ruleStepCases.filter(
  ([, { step }]) => step.introducedRuleId !== null,
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

  test("導入で見せる解き終えた盤面は、解であること", () => {
    const result = takuzuTutorial.goal().board;

    expect(result).toEqual(solution);
  });

  test("操作の手順は、1つ目で1回タップした四角、2つ目で2回タップした丸を置くこと", () => {
    const result = takuzuTutorial.steps
      .slice(0, operationStepCount)
      .map((step) => step.cellIndices.map((index) => solution.cells[index]));

    expect(result).toEqual([["a"], ["b"]]);
  });

  test.each(ruleStepCases)(
    "手順 %i の印のマスは、始めた盤面で、手に入れたルールだけで解のタイルに決まること",
    (_, { step, board, earnedRuleIds, expected }) => {
      const result = step.cellIndices.map(
        (cellIndex) =>
          deduceCell(board, earnedRuleIds, cellIndex)?.tile ?? null,
      );

      expect(result).toEqual(expected);
    },
  );

  test.each(introducingStepCases)(
    "手順 %i の印のマスは、その手順で示すルールで決まり、それまでのルールでは決まらないこと",
    (_, { step, board, earnedRuleIds, expected }) => {
      const introducedRuleIds = earnedRuleIds.filter(
        (ruleId) => ruleId === step.introducedRuleId,
      );
      const earlierRuleIds = earnedRuleIds.filter(
        (ruleId) => ruleId !== step.introducedRuleId,
      );

      const byIntroduced = step.cellIndices.map(
        (cellIndex) =>
          deduceCell(board, introducedRuleIds, cellIndex)?.tile ?? null,
      );
      const byEarlier = step.cellIndices.map((cellIndex) =>
        deduceCell(board, earlierRuleIds, cellIndex),
      );

      expect(byIntroduced).toEqual(expected);
      expect(byEarlier).toEqual(step.cellIndices.map(() => null));
    },
  );

  test("手順を終えると空きが残り、3つのルールで決まるマスを順に埋めて解き切れること", () => {
    const result = fillByDeduction(releasedBoard, allRuleIds);

    expect(getEmptyCellIndices(releasedBoard).length).toBeGreaterThan(0);
    expect(result).toEqual(solution.cells);
  });
});

describe("takuzuTutorial.perform", () => {
  const started = finishTutorialIntro(startTutorial(takuzuTutorial));
  const afterFirstStep = finishSteps(1);
  const released = finishSteps(takuzuTutorial.steps.length);

  test("手を引いている間は、印の無いマスへの操作で盤面を変えないこと", () => {
    const result = performAll(started, [tap(cellAt(1, 3)), tap(cellAt(4, 4))]);

    expect(result).toBe(started);
  });

  test("固定マスへの操作で盤面を変えないこと", () => {
    const result = performAll(released, [tap(cellAt(1, 2))]);

    expect(result).toBe(released);
  });

  test("1つ目の手順のマスを1回タップすると四角になり、次の手順へ進むこと", () => {
    const result = performAll(started, [tap(cellAt(1, 1))]);

    expect(result.boardState.board.cells[cellAt(1, 1)]).toBe("a");
    expect(result.stepIndex).toBe(1);
  });

  test("2つ目の手順のマスは、2回タップして丸にすると次の手順へ進むこと", () => {
    const once = performAll(afterFirstStep, [tap(cellAt(2, 4))]);
    const twice = performAll(once, [tap(cellAt(2, 4))]);

    expect(once.stepIndex).toBe(1);
    expect(twice.stepIndex).toBe(2);
  });

  describe("3つ続かないことを示す手順で", () => {
    const runStep = finishSteps(2);

    test("四角を置くと、ルールに合わないとして進まず、3つ続くマスを示すこと", () => {
      const result = performAll(runStep, [tap(cellAt(1, 3))]);
      const cellViews = getTakuzuTutorialCellViews(
        getTutorialSituation(takuzuTutorial, result),
        result.boardState,
      );

      expect(result.violated).toBe(true);
      expect(result.stepIndex).toBe(2);
      expect(cellViews.slice(0, 4).map((view) => view.inViolatingRun)).toEqual([
        true,
        true,
        true,
        false,
      ]);
    });

    test("丸にすると、並んだ2つの四角を決め手にして次の手順へ進むこと", () => {
      const result = performAll(runStep, [
        tap(cellAt(1, 3)),
        tap(cellAt(1, 3)),
      ]);

      expect(result.violated).toBe(false);
      expect(result.stepIndex).toBe(3);
      expect(result.boardState.lastMove?.reasonCellIndices).toEqual([
        cellAt(1, 1),
        cellAt(1, 2),
      ]);
    });
  });

  describe("同じ並びを示す手順で", () => {
    const duplicateStepIndex = takuzuTutorial.steps.length - 1;
    const duplicateStep = finishSteps(duplicateStepIndex);

    test("片方のマスを置いても進まず、もう片方に印を付け続けること", () => {
      const result = performAll(duplicateStep, placeSolution([cellAt(2, 2)]));
      const stepCellIndices = getTakuzuTutorialStepCellIndices(
        getTutorialSituation(takuzuTutorial, result),
        result.boardState,
      );

      expect(result.stepIndex).toBe(duplicateStepIndex);
      expect(stepCellIndices).toEqual([cellAt(2, 3)]);
    });

    test("1行目と同じ並びにすると、ルールに合わないとして重なった行を示すこと", () => {
      const result = performAll(duplicateStep, [
        place(cellAt(2, 2), "a"),
        place(cellAt(2, 3), "b"),
      ]);
      const lineViolations = getTakuzuTutorialLineViolations(
        getTutorialSituation(takuzuTutorial, result),
        result.boardState,
      );

      expect(result.violated).toBe(true);
      expect(lineViolations).toEqual([
        { axis: "row", index: 0, overfilled: false, duplicated: true },
        { axis: "row", index: 1, overfilled: false, duplicated: true },
      ]);
    });
  });

  describe("手順を終えた後", () => {
    const [emptyCellIndex = -1] = getEmptyCellIndices(
      released.boardState.board,
    );
    const situation = getTutorialSituation(takuzuTutorial, released);

    test("手を離し、どの空きマスにも置けること", () => {
      const result = performAll(released, [tap(emptyCellIndex)]);

      expect(situation.step).toBeNull();
      expect(result.boardState.board.cells[emptyCellIndex]).toBe("a");
    });

    test("手が止まったときに示すマスは、3つのルールで決まるマスであること", () => {
      const cellIndex = findTakuzuTutorialHintCellIndex(
        situation,
        released.boardState,
      );

      const deduction = deduceCell(
        released.boardState.board,
        allRuleIds,
        cellIndex ?? -1,
      );

      expect(cellIndex).not.toBeNull();
      expect(deduction?.tile).toBe(solution.cells[cellIndex ?? -1]);
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
      "四角が3つ続いた",
      2,
      [tap(cellAt(1, 3))],
      {
        headline: "四角が3つ続いています",
        detail: "同じものは、3つ続けて並べられません",
      },
    ],
    [
      "四角が多すぎる行ができた",
      4,
      [place(cellAt(1, 4), "a")],
      {
        headline: "四角が多すぎる行があります",
        detail: "行も列も、四角と丸は同じ数ずつです",
      },
    ],
    [
      "上の行と同じ並びにした",
      takuzuTutorial.steps.length - 1,
      [place(cellAt(2, 2), "a"), place(cellAt(2, 3), "b")],
      {
        headline: "上の行と同じ並びになっています",
        detail: "同じ並びの行・列は作れません",
      },
    ],
  ] as const;

  const progressCases = cases.map(
    ([name, stepIndex, actions, expected]) =>
      [name, performAll(finishSteps(stepIndex), actions), expected] as const,
  );

  test.each(progressCases)(
    "当たったルールを具体的に言うこと: %s",
    (_, progress, expected) => {
      const result = takuzuTutorial.describeViolation(
        getTutorialSituation(takuzuTutorial, progress),
        progress.boardState,
      );

      expect(result).toEqual(expected);
    },
  );
});
