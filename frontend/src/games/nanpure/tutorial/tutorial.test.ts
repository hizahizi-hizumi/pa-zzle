import {
  NANPURE_DIGITS,
  type NanpureBoard,
  type NanpureCell,
  type NanpureDigit,
} from "@/games/nanpure/puzzle/board";
import {
  findNanpureConflictCellIndices,
  getNanpureCandidates,
  isNanpureSolved,
} from "@/games/nanpure/puzzle/rules";
import {
  _private,
  describeNanpureTutorialMistake,
  describeNanpureTutorialStep,
  findNanpureTutorialHint,
  findNanpureTutorialWrongCellIndex,
  getNanpureTutorialCompletedDigits,
  getNanpureTutorialConflictCellIndices,
  getNanpureTutorialCuedDigit,
  getNanpureTutorialMistakeCellIndices,
  getNanpureTutorialProgressRatio,
  getNanpureTutorialStepCellIndex,
  getNanpureTutorialStepFocus,
  getNanpureTutorialUnitCellIndices,
  isNanpureTutorialCellSelectable,
  NANPURE_TUTORIAL_PROGRESS_STEP_COUNT,
  type NanpureTutorialAction,
  type NanpureTutorialBoardState,
  type NanpureTutorialMarkedCellStep,
  type NanpureTutorialPlacementStep,
  type NanpureTutorialRuleId,
  type NanpureTutorialStep,
  nanpureTutorial,
} from "@/games/nanpure/tutorial/tutorial";
import {
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

const {
  givens,
  solution,
  cellAt,
  getStepAnswerCellIndex,
  deduceLastEmptyCell,
  findPlacement,
} = _private;

type Progress = TutorialProgress<
  NanpureTutorialRuleId,
  NanpureTutorialBoardState
>;

const allRuleIds = [
  "row",
  "column",
  "block",
] as const satisfies readonly NanpureTutorialRuleId[];

function solutionDigit(cellIndex: number): NanpureDigit {
  const digit = solution[cellIndex];
  if (!digit) {
    throw new Error(`no solution at ${cellIndex}`);
  }
  return digit;
}

function enter(cellIndex: number, digit: NanpureDigit): NanpureTutorialAction {
  return { cellIndex, digit };
}

function performAll(
  progress: Progress,
  actions: readonly NanpureTutorialAction[],
): Progress {
  return actions.reduce(
    (current, action) =>
      performTutorialAction(nanpureTutorial, current, action),
    progress,
  );
}

/** 最初の `count` 個の手順を、手順のマスへ解の数字を入れて終える。 */
function finishSteps(count: number): Progress {
  return nanpureTutorial.steps
    .slice(0, count)
    .reduce(
      (progress, step) =>
        performAll(progress, [
          enter(
            getStepAnswerCellIndex(step),
            solutionDigit(getStepAnswerCellIndex(step)),
          ),
        ]),
      finishTutorialIntro(startTutorial(nanpureTutorial)),
    );
}

function getEmptyCellIndices(board: NanpureBoard): number[] {
  return board.flatMap((cell, index) => (cell === null ? [index] : []));
}

function countSolutions(board: NanpureBoard): number {
  const [cellIndex] = getEmptyCellIndices(board);
  if (cellIndex === undefined) {
    return isNanpureSolved(board) ? 1 : 0;
  }
  return getNanpureCandidates(board, cellIndex).reduce((count, digit) => {
    const next = [...board];
    next[cellIndex] = digit;
    return count + countSolutions(next);
  }, 0);
}

const blockIndices = Array.from({ length: 9 }, (_, index) => index);

/** 盤面のすべての、ブロックの中で置き場所が1つに決まる数字。 */
function findPlacements(board: NanpureBoard) {
  return blockIndices.flatMap((blockIndex) =>
    NANPURE_DIGITS.flatMap((digit) => {
      const placement = findPlacement(board, blockIndex, digit);
      return placement ? [placement] : [];
    }),
  );
}

/**
 * まとまりで最後に空いたマスを先に、無ければ（`usesPlacement` なら）ブロックの中の置き場所を、1つずつ埋める。
 * 埋めた後の盤面と、置き場所の読みを使った回数を返す。
 */
function fillByReads(
  board: NanpureBoard,
  usesPlacement: boolean,
): { board: NanpureCell[]; placementCount: number } {
  const cells = [...board];
  let placementCount = 0;
  for (;;) {
    const lastEmpty = cells
      .map((_, cellIndex) => ({
        cellIndex,
        deduction: deduceLastEmptyCell(cells, allRuleIds, cellIndex),
      }))
      .find(({ deduction }) => deduction !== null);
    if (lastEmpty?.deduction) {
      cells[lastEmpty.cellIndex] = lastEmpty.deduction.digit;
      continue;
    }
    const [placement] = usesPlacement ? findPlacements(cells) : [];
    if (!placement) {
      return { board: cells, placementCount };
    }
    cells[placement.cellIndex] = placement.digit;
    placementCount += 1;
  }
}

function isMarkedCellStep(
  step: NanpureTutorialStep,
): step is NanpureTutorialMarkedCellStep {
  return step.kind === "marked-cell";
}

function isPlacementStep(
  step: NanpureTutorialStep,
): step is NanpureTutorialPlacementStep {
  return step.kind === "placement";
}

const operationStepCount = nanpureTutorial.steps.findIndex(
  (step) => step.introducedRuleId !== null,
);

/** 手順ごとの、始めた盤面と手に入れたルール、手順のマスの解。 */
const stepCases = nanpureTutorial.steps.map(
  function createStepCase(step, stepIndex) {
    const progress = finishSteps(stepIndex);
    return [
      stepIndex,
      {
        step,
        progress,
        board: progress.boardState.board,
        earnedRuleIds: progress.earnedRuleIds,
        expected: solutionDigit(getStepAnswerCellIndex(step)),
      },
    ] as const;
  },
);
const markedCellStepCases = stepCases.flatMap(([stepIndex, stepCase]) =>
  isMarkedCellStep(stepCase.step)
    ? [[stepIndex, { ...stepCase, step: stepCase.step }] as const]
    : [],
);
const ruleStepCases = markedCellStepCases.filter(
  ([, { step }]) => step.introducedRuleId !== null,
);
const placementStepCases = stepCases.flatMap(([stepIndex, stepCase]) =>
  isPlacementStep(stepCase.step)
    ? [[stepIndex, { ...stepCase, step: stepCase.step }] as const]
    : [],
);

function getPlacementStepCase() {
  const [placementStepCase] = placementStepCases;
  if (!placementStepCase) {
    throw new Error("no placement step");
  }
  return placementStepCase;
}

describe("nanpureTutorial の盤面", () => {
  const releasedBoard = finishSteps(nanpureTutorial.steps.length).boardState
    .board;
  const emptyCellIndices = getEmptyCellIndices(givens);

  test("解は行・列・ブロックのルールに合い、最初の数字を含むこと", () => {
    const changedGivens = givens.filter(
      (cell, index) => cell !== null && cell !== solution[index],
    );

    expect(isNanpureSolved(solution)).toBe(true);
    expect(changedGivens).toEqual([]);
  });

  test("最初の数字だけで、ルールに合う埋め方が解だけになること", () => {
    const result = countSolutions(givens);

    expect(result).toBe(1);
  });

  test("空きマスは18〜22個で、空きマスの解に1〜9がすべてあること", () => {
    const digits = new Set(emptyCellIndices.map(solutionDigit));

    expect(emptyCellIndices.length).toBeGreaterThanOrEqual(18);
    expect(emptyCellIndices.length).toBeLessThanOrEqual(22);
    expect([...digits].sort()).toEqual([...NANPURE_DIGITS]);
  });

  test("最初の盤面から、最後に空いたマスと置き場所の2つの読みだけで解き切れること", () => {
    const result = fillByReads(givens, true);

    expect(result.board).toEqual(solution);
  });

  test("最初から押せない数字のボタンが無いこと", () => {
    const result = getNanpureTutorialCompletedDigits(nanpureTutorial.start());

    expect(result).toEqual([]);
  });

  test("導入で見せる解き終えた盤面は、解であること", () => {
    const result = nanpureTutorial.goal().board;

    expect(result).toEqual(solution);
  });

  test("操作の手順は、印のマスに入れる解の数字を押させること", () => {
    const result = nanpureTutorial.steps
      .slice(0, operationStepCount)
      .map(
        (step) =>
          isMarkedCellStep(step) &&
          step.cuedDigit === solutionDigit(step.cuedCellIndex),
      );

    expect(result).toEqual([true]);
  });

  test("手順は、操作・行・列・ブロックの後に、置き場所を探す手順で終わること", () => {
    const result = nanpureTutorial.steps.map((step) =>
      isMarkedCellStep(step)
        ? (step.introducedRuleId ?? "operation")
        : step.kind,
    );

    expect(result).toEqual([
      "operation",
      "row",
      "column",
      "block",
      "placement",
    ]);
  });

  test.each(ruleStepCases)(
    "手順 %i の印のマスは、始めた盤面で、示すまとまりで最後に空いたマスであり、そのまとまりが決め手であること",
    (_, { step, board, earnedRuleIds, expected }) => {
      const result = deduceLastEmptyCell(
        board,
        earnedRuleIds,
        step.cuedCellIndex,
      );

      expect(result?.digit).toBe(expected);
      expect(result ? [result.unit] : []).toEqual(step.reasonUnits);
    },
  );

  test.each(ruleStepCases)(
    "手順 %i の印のマスは、それまでのルールを合わせても数字が1つに決まらないこと",
    (_, { step, board, earnedRuleIds }) => {
      const earlierRuleIds = earnedRuleIds.filter(
        (ruleId) => ruleId !== step.introducedRuleId,
      );

      const result = getNanpureCandidates(
        board,
        step.cuedCellIndex,
        earlierRuleIds,
      );

      expect(result.length).toBeGreaterThan(1);
    },
  );

  test.each(stepCases)(
    "手順 %i を始めた盤面（マスを選んだだけの途中も同じ盤面）と、手順のマスに解の数字を入れた盤面は、まだ示していないルールを含めてどのルールにも反しないこと",
    (_, { step, board, expected }) => {
      const entered = [...board];
      entered[getStepAnswerCellIndex(step)] = expected;

      const result = [board, entered].map((cells) =>
        findNanpureConflictCellIndices(cells),
      );

      expect(result).toEqual([[], []]);
    },
  );

  test("行・列・ブロックのルールのそれぞれが、いずれかの手順の決め手になること", () => {
    const result = new Set(
      nanpureTutorial.steps.flatMap((step) =>
        isMarkedCellStep(step) ? step.reasonUnits.map((unit) => unit.kind) : [],
      ),
    );

    expect([...result].sort()).toEqual([...allRuleIds].sort());
  });

  test.each(ruleStepCases)(
    "手順 %i の印のマスに解と違う数字を入れると、手に入れたルールで重なりが見えること",
    (_, { step, board, earnedRuleIds, expected }) => {
      const result = NANPURE_DIGITS.filter((digit) => digit !== expected).map(
        (digit) => {
          const next = [...board];
          next[step.cuedCellIndex] = digit;
          return getNanpureTutorialConflictCellIndices(
            { step, earnedRuleIds },
            { board: next, moveCount: 0, lastMove: null },
          ).includes(step.cuedCellIndex);
        },
      );

      expect(result.every(Boolean)).toBe(true);
    },
  );

  test.each(placementStepCases)(
    "手順 %i を始めた盤面では、ブロックに空きマスが3つ以上あり、示す数字はまだブロックに無く、入るマスは手順のマスだけであること",
    (_, { step, board }) => {
      const blockCells = getNanpureTutorialUnitCellIndices(step.block);
      const emptyBlockCells = blockCells.filter(
        (cellIndex) => board[cellIndex] === null,
      );
      const digitInBlock = blockCells.some(
        (cellIndex) => board[cellIndex] === step.digit,
      );

      const result = findPlacement(board, step.block.index, step.digit);

      expect(emptyBlockCells.length).toBeGreaterThanOrEqual(3);
      expect(digitInBlock).toBe(false);
      expect(result?.cellIndex).toBe(step.cellIndex);
      expect(step.digit).toBe(solutionDigit(step.cellIndex));
    },
  );

  test.each(placementStepCases)(
    "手順 %i のマスは、どのまとまりでも最後に空いたマスではないこと",
    (_, { step, board }) => {
      const result = deduceLastEmptyCell(board, allRuleIds, step.cellIndex);

      expect(result).toBeNull();
    },
  );

  test("手順を終えて残るマスは10〜14個であること", () => {
    const result = getEmptyCellIndices(releasedBoard).length;

    expect(result).toBeGreaterThanOrEqual(10);
    expect(result).toBeLessThanOrEqual(14);
  });

  test("手順を終えて残るマスは、最後に空いたマスと置き場所の2つの読みだけで解き切れ、置き場所の読みが3回以上要ること", () => {
    const result = fillByReads(releasedBoard, true);

    expect(result.board).toEqual(solution);
    expect(result.placementCount).toBeGreaterThanOrEqual(3);
  });

  test("手順を終えて残るマスは、最後に空いたマスの読みだけでは解き切れないこと", () => {
    const result = fillByReads(releasedBoard, false);

    expect(getEmptyCellIndices(result.board).length).toBeGreaterThan(0);
  });
});

describe("nanpureTutorial の進行", () => {
  test("最初の数字は変えられないこと", () => {
    const progress = finishSteps(nanpureTutorial.steps.length);

    const result = performTutorialAction(
      nanpureTutorial,
      progress,
      enter(cellAt(1, 2), 3),
    );

    expect(result).toBe(progress);
  });

  describe("操作の手順の場合", () => {
    const progress = finishSteps(0);
    const situation = getTutorialSituation(nanpureTutorial, progress);
    const [step] = nanpureTutorial.steps;
    const cellIndex = step ? getStepAnswerCellIndex(step) : -1;

    test("印のマスだけを選べること", () => {
      const result = [cellIndex, cellAt(1, 1), cellAt(2, 2)].map((index) =>
        isNanpureTutorialCellSelectable(situation, progress.boardState, index),
      );

      expect(result).toEqual([true, false, false]);
    });

    test("印のマスのほかへ数字を入れても何も起きないこと", () => {
      const result = performTutorialAction(
        nanpureTutorial,
        progress,
        enter(cellAt(2, 2), 9),
      );

      expect(result).toBe(progress);
    });

    test("印のマスに押させたい数字のほかを入れても何も起きないこと", () => {
      const result = performTutorialAction(
        nanpureTutorial,
        progress,
        enter(cellIndex, 1),
      );
      const resultSituation = getTutorialSituation(nanpureTutorial, result);

      expect(result).toBe(progress);
      expect(
        getNanpureTutorialStepCellIndex(resultSituation, result.boardState),
      ).toBe(cellIndex);
    });

    test("印のマスを選んでいる間だけ、押させたい数字を返すこと", () => {
      const result = [cellIndex, null, cellAt(2, 2)].map((selected) =>
        getNanpureTutorialCuedDigit(situation, selected),
      );

      expect(result).toEqual([solutionDigit(cellIndex), null, null]);
    });
  });

  test("行のルールを示した後、行で重なる数字を入れると、どの行に何が重なったかを言うこと", () => {
    const progress = finishSteps(1);

    const result = performTutorialAction(
      nanpureTutorial,
      progress,
      enter(cellAt(3, 3), 9),
    );
    const message = getTutorialMessage(nanpureTutorial, result, {
      entry: "home",
      violationSettled: true,
    });

    expect(result.violated).toBe(true);
    expect(message).toEqual({
      headline: "この行にはもう9があります",
      detail: "別の数字を押すと入れ直せます",
    });
  });

  test("列のルールを示した後、行と列の両方で重なる数字を入れると、赤く示す行と列の両方の重なりを言うこと", () => {
    const progress = finishSteps(2);

    const result = performTutorialAction(
      nanpureTutorial,
      progress,
      enter(cellAt(6, 6), 9),
    );
    const message = getTutorialMessage(nanpureTutorial, result, {
      entry: "home",
      violationSettled: true,
    });

    expect(message.headline).toBe("この行と列にはもう9があります");
  });

  test("重なった数字を正しい数字に入れ替えると、次の手順へ進むこと", () => {
    const progress = finishSteps(1);

    const result = performAll(progress, [
      enter(cellAt(3, 3), 9),
      enter(cellAt(3, 3), solutionDigit(cellAt(3, 3))),
    ]);

    expect(result.violated).toBe(false);
    expect(result.stepIndex).toBe(2);
  });

  describe("置き場所を探す手順の場合", () => {
    const [stepIndex, { step, progress }] = getPlacementStepCase();
    const situation = getTutorialSituation(nanpureTutorial, progress);
    const { boardState } = progress;
    const targetCellIndex = cellAt(6, 8);
    const rowOnlyCellIndex = cellAt(5, 8);
    const columnOnlyCellIndex = cellAt(6, 9);
    const rowAndColumnCellIndex = cellAt(5, 7);
    const selectionCases = [
      [
        "選んでいない",
        null,
        {
          headline: "このブロックで2が入るマスを探します",
          detail: "2がある行と列を除いて探します",
        },
      ],
      [
        "ブロックの外のマスを選んだ",
        cellAt(1, 1),
        {
          headline: "このブロックで2が入るマスを探します",
          detail: "2がある行と列を除いて探します",
        },
      ],
      [
        "同じ行に2があるマスを選んだ",
        rowOnlyCellIndex,
        {
          headline: "この行にはもう2があります",
          detail: "ほかのマスを選びます",
        },
      ],
      [
        "同じ列に2があるマスを選んだ",
        columnOnlyCellIndex,
        {
          headline: "この列にはもう2があります",
          detail: "ほかのマスを選びます",
        },
      ],
      [
        "同じ行と列に2があるマスを選んだ",
        rowAndColumnCellIndex,
        {
          headline: "この行と列にはもう2があります",
          detail: "ほかのマスを選びます",
        },
      ],
      [
        "2が入るマスを選んだ",
        targetCellIndex,
        { headline: "ここが2の入るマスです", detail: "下の2を押します" },
      ],
    ] as const;

    test("最後の手順として、6行8列に2を入れさせること", () => {
      expect(stepIndex).toBe(nanpureTutorial.steps.length - 1);
      expect(step).toMatchObject({
        digit: 2,
        block: { kind: "block", index: 5 },
        cellIndex: targetCellIndex,
      });
    });

    test("ブロックの空きマスだけを選べること", () => {
      const blockCells = getNanpureTutorialUnitCellIndices({
        kind: "block",
        index: 5,
      });

      const result = blockCells.filter((cellIndex) =>
        isNanpureTutorialCellSelectable(situation, boardState, cellIndex),
      );
      const outside = isNanpureTutorialCellSelectable(
        situation,
        boardState,
        cellAt(1, 1),
      );

      expect(result).toEqual([
        rowAndColumnCellIndex,
        rowOnlyCellIndex,
        targetCellIndex,
        columnOnlyCellIndex,
      ]);
      expect(outside).toBe(false);
    });

    test.each(selectionCases)(
      "選んでいるマスに応じた一言を返すこと: %s",
      (_, selectedCellIndex, expected) => {
        const result = describeNanpureTutorialStep(
          situation,
          boardState,
          selectedCellIndex,
        );

        expect(result).toEqual(expected);
      },
    );

    test("2が入るマスを選んでいる間だけ、2を押させること", () => {
      const result = [targetCellIndex, rowOnlyCellIndex, null].map((selected) =>
        getNanpureTutorialCuedDigit(situation, selected),
      );

      expect(result).toEqual([2, null, null]);
    });

    test("マスに印を付けず、ブロックと、ブロックの空きマスを消している2のマスを見せること", () => {
      const stepCellIndex = getNanpureTutorialStepCellIndex(
        situation,
        boardState,
      );

      const result = getNanpureTutorialStepFocus(situation, boardState);

      expect(stepCellIndex).toBeNull();
      expect(result).toEqual({
        cellIndices: [cellAt(2, 7), cellAt(5, 3), cellAt(9, 9)],
        units: [{ kind: "block", index: 5 }],
      });
    });

    test("2が入らないマスへ数字を入れても何も起きないこと", () => {
      const result = performTutorialAction(
        nanpureTutorial,
        progress,
        enter(rowOnlyCellIndex, 4),
      );

      expect(result).toBe(progress);
    });

    test("2が入るマスに2を入れると、手を離すこと", () => {
      const result = performTutorialAction(
        nanpureTutorial,
        progress,
        enter(targetCellIndex, 2),
      );

      expect(result.stepIndex).toBe(nanpureTutorial.steps.length);
    });

    test("2が入るマスに違う数字を入れると、手順を終えずにミスとして残すこと", () => {
      const result = performTutorialAction(
        nanpureTutorial,
        progress,
        enter(targetCellIndex, 3),
      );

      expect(result.stepIndex).toBe(stepIndex);
      expect(getNanpureTutorialMistakeCellIndices(result.boardState)).toEqual([
        targetCellIndex,
      ]);
    });
  });

  test("手を離した後、前に入れた違う数字と重なる正しい数字を入れると、正しい手として応え、違う数字のマスを直させること", () => {
    const progress = performAll(finishSteps(nanpureTutorial.steps.length), [
      enter(cellAt(6, 4), 7),
      enter(cellAt(1, 4), 7),
    ]);
    const situation = getTutorialSituation(nanpureTutorial, progress);
    const message = getTutorialMessage(nanpureTutorial, progress, {
      entry: "home",
      violationSettled: true,
    });

    expect(progress.boardState.lastMove?.violated).toBe(false);
    expect(progress.boardState.lastMove?.reasonUnits).toEqual([
      { kind: "row", index: 0 },
    ]);
    expect(progress.violated).toBe(true);
    expect(message).toEqual({
      headline: "印のマスの数字が違います",
      detail: "印のマスを選んで\n別の数字を入れます",
    });
    expect(
      findNanpureTutorialWrongCellIndex(situation, progress.boardState),
    ).toBe(cellAt(6, 4));
  });

  test("違う数字を残したまま空きマスを埋めると、重なりを直させる一言を続けること", () => {
    const released = finishSteps(nanpureTutorial.steps.length);
    const remaining = getEmptyCellIndices(released.boardState.board);
    const progress = performAll(released, [
      enter(cellAt(3, 5), 2),
      ...remaining.map((cellIndex) =>
        enter(cellIndex, solutionDigit(cellIndex)),
      ),
    ]);
    const message = getTutorialMessage(nanpureTutorial, progress, {
      entry: "home",
      violationSettled: true,
    });

    expect(getEmptyCellIndices(progress.boardState.board)).toEqual([]);
    expect(progress.phase).toBe("playing");
    expect(message.headline).toBe("印のマスの数字が違います");
  });

  test("手順を終えると手を離し、どのマスも選べ、残りを埋めると解けること", () => {
    const progress = finishSteps(nanpureTutorial.steps.length);
    const situation = getTutorialSituation(nanpureTutorial, progress);
    const remaining = getEmptyCellIndices(progress.boardState.board);

    const result = performAll(
      progress,
      remaining.map((cellIndex) => enter(cellIndex, solutionDigit(cellIndex))),
    );

    expect(progress.stepIndex).toBe(nanpureTutorial.steps.length);
    expect(progress.earnedRuleIds).toEqual(allRuleIds);
    expect(
      isNanpureTutorialCellSelectable(
        situation,
        progress.boardState,
        cellAt(1, 1),
      ),
    ).toBe(true);
    expect(result.phase).toBe("solved");
  });
});

describe("findNanpureTutorialHint", () => {
  const released = finishSteps(nanpureTutorial.steps.length);
  const situation = getTutorialSituation(nanpureTutorial, released);

  describe("手を離した直後の盤面の場合", () => {
    test("まとまりで最後に空いたマスを、そのまとまりと、そのまとまりのルールを示した手順の一言と一緒に示すこと", () => {
      const result = findNanpureTutorialHint(situation, released.boardState);
      const rowStep = nanpureTutorial.steps.find(
        ({ introducedRuleId }) => introducedRuleId === "row",
      );

      expect(result).toEqual({
        kind: "last-empty",
        cellIndex: cellAt(1, 4),
        unit: { kind: "row", index: 0 },
        message: rowStep?.message,
      });
    });
  });

  describe("まとまりで最後に空いたマスが無い盤面の場合", () => {
    const state: NanpureTutorialBoardState = {
      ...released.boardState,
      board: released.boardState.board.map((digit, cellIndex) =>
        [cellAt(1, 4), cellAt(6, 4), cellAt(6, 9)].includes(cellIndex)
          ? solutionDigit(cellIndex)
          : digit,
      ),
    };

    test("ブロックの中で置き場所が1つに決まる数字を、置き場所を絞る数字のマスと一緒に示すこと", () => {
      const result = findNanpureTutorialHint(situation, state);

      expect(result).toEqual({
        kind: "placement",
        placement: {
          digit: 1,
          block: { kind: "block", index: 0 },
          cellIndex: cellAt(2, 3),
          eliminatingCellIndices: [cellAt(9, 2)],
        },
        message: {
          headline: "このブロックで1が入るマスを\n探します",
          detail: "1がある行と列を除いて探します",
        },
      });
    });
  });

  describe("答えと違う数字がある場合", () => {
    const progress = performAll(released, [enter(cellAt(1, 4), 1)]);
    const wrongSituation = getTutorialSituation(nanpureTutorial, progress);

    test("その数字のマスを示すこと", () => {
      const result = findNanpureTutorialHint(
        wrongSituation,
        progress.boardState,
      );

      expect(result).toEqual({ kind: "wrong-digit", cellIndex: cellAt(1, 4) });
    });
  });
});

describe("getNanpureTutorialProgressRatio", () => {
  const states = [
    nanpureTutorial.start(),
    finishSteps(nanpureTutorial.steps.length).boardState,
    nanpureTutorial.goal(),
  ];

  test("始めの盤面では0、手を離した盤面では手順の数の分、解き終えた盤面では1を返すこと", () => {
    const result = states.map(getNanpureTutorialProgressRatio);

    expect(result).toEqual([
      0,
      nanpureTutorial.steps.length / NANPURE_TUTORIAL_PROGRESS_STEP_COUNT,
      1,
    ]);
  });
});

describe("getNanpureTutorialMistakeCellIndices", () => {
  const cellIndex = cellAt(3, 5);
  const board = givens.map((cell, index) => (index === cellIndex ? 1 : cell));
  const state: NanpureTutorialBoardState = {
    board,
    moveCount: 1,
    lastMove: null,
  };
  const noRuleSituation = { step: null, earnedRuleIds: [] };

  test("本番と同じく、ルールの重なりが見えていなくても、解と違う数字のマスを返すこと", () => {
    const result = getNanpureTutorialMistakeCellIndices(state);
    const conflicts = getNanpureTutorialConflictCellIndices(
      noRuleSituation,
      state,
    );

    expect(result).toEqual([cellIndex]);
    expect(conflicts).toEqual([]);
  });
});

describe("3つのルールを手に入れた場合", () => {
  const released = finishSteps(nanpureTutorial.steps.length);
  const situation = getTutorialSituation(nanpureTutorial, released);
  const releasedBoard = released.boardState.board;
  const enteredBoards = getEmptyCellIndices(releasedBoard).flatMap(
    (cellIndex) =>
      NANPURE_DIGITS.map((digit) => {
        const board = [...releasedBoard];
        board[cellIndex] = digit;
        return board;
      }),
  );

  test("重なりのマスは、どの盤面でも本番の findNanpureConflictCellIndices と一致すること", () => {
    const result = enteredBoards.map((board) =>
      getNanpureTutorialConflictCellIndices(situation, {
        board,
        moveCount: 0,
        lastMove: null,
      }),
    );

    expect(result).toEqual(
      enteredBoards.map((board) => findNanpureConflictCellIndices(board)),
    );
  });
});

describe("describeNanpureTutorialMistake", () => {
  const operationCellIndex = 2 * 9 + 4;
  const board = nanpureTutorial.start().board;
  const cases = [
    [
      "どこにも重ならない、答えと違う数字を入れた",
      { cellIndex: operationCellIndex, digit: 7, violated: false },
      {
        headline: "7は別のマスに入ります",
        detail: "本番では入れ間違いが\nミスに数えられます",
      },
    ],
    [
      "重なった数字を入れた",
      { cellIndex: operationCellIndex, digit: 1, violated: true },
      null,
    ],
    [
      "答えの数字を入れた",
      { cellIndex: operationCellIndex, digit: 8, violated: false },
      null,
    ],
  ] as const;

  test.each(cases)(
    "重ならない誤りにだけ一言を返すこと: %s",
    (_, move, expected) => {
      const result = describeNanpureTutorialMistake({
        board,
        moveCount: 1,
        lastMove: { ...move, fitsStep: false, reasonUnits: [] },
      });

      expect(result).toEqual(expected);
    },
  );

  test("まだ手を入れていなければ一言を返さないこと", () => {
    const result = describeNanpureTutorialMistake(nanpureTutorial.start());

    expect(result).toBeNull();
  });
});
