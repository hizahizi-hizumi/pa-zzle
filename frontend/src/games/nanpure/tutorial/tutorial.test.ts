import {
  NANPURE_DIGITS,
  type NanpureBoard,
  type NanpureCell,
  type NanpureDigit,
} from "@/games/nanpure/puzzle/board";
import {
  getNanpureCandidates,
  isNanpureSolved,
} from "@/games/nanpure/puzzle/rules";
import {
  _private,
  findNanpureTutorialHint,
  findNanpureTutorialWrongCellIndex,
  getNanpureTutorialCompletedDigits,
  getNanpureTutorialConflictCellIndices,
  getNanpureTutorialStepCellIndex,
  isNanpureTutorialCellSelectable,
  type NanpureTutorialAction,
  type NanpureTutorialBoardState,
  type NanpureTutorialRuleId,
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

const { givens, solution, cellAt, deduceCell } = _private;

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

/** 最初の `count` 個の手順を、印のマスへ解の数字を入れて終える。 */
function finishSteps(count: number): Progress {
  return nanpureTutorial.steps
    .slice(0, count)
    .reduce(
      (progress, step) =>
        performAll(progress, [
          enter(step.cellIndex, solutionDigit(step.cellIndex)),
        ]),
      finishTutorialIntro(startTutorial(nanpureTutorial)),
    );
}

function getEmptyCellIndices(board: NanpureBoard): number[] {
  return board.flatMap((cell, index) => (cell === null ? [index] : []));
}

/** 空きマスを入り得る数字で埋めていき、ルールに合う埋め方の数を数える。 */
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

/** 決まるマスを、決まらなくなるまで1つずつ埋める。 */
function fillByDeduction(
  board: NanpureBoard,
  ruleIds: readonly NanpureTutorialRuleId[],
): NanpureCell[] {
  const cells = [...board];
  for (;;) {
    const deduced = cells
      .map((_, cellIndex) => ({
        cellIndex,
        deduction: deduceCell(cells, ruleIds, cellIndex),
      }))
      .find(({ deduction }) => deduction !== null);
    if (!deduced?.deduction) {
      return cells;
    }
    cells[deduced.cellIndex] = deduced.deduction.digit;
  }
}

const operationStepCount = nanpureTutorial.steps.findIndex(
  (step) => step.introducedRuleId !== null,
);

/** 手順ごとの、始めた盤面と手に入れたルール、印のマスの解。 */
const stepCases = nanpureTutorial.steps.map(
  function createStepCase(step, stepIndex) {
    const progress = finishSteps(stepIndex);
    return [
      stepIndex,
      {
        step,
        board: progress.boardState.board,
        earnedRuleIds: progress.earnedRuleIds,
        expected: solutionDigit(step.cellIndex),
      },
    ] as const;
  },
);
const ruleStepCases = stepCases.slice(operationStepCount);
const introducingStepCases = ruleStepCases.filter(
  ([, { step }]) => step.introducedRuleId !== null,
);
const combiningStepCases = ruleStepCases.filter(
  ([, { step }]) => step.introducedRuleId === null,
);

describe("nanpureTutorial の盤面", () => {
  const releasedBoard = finishSteps(nanpureTutorial.steps.length).boardState
    .board;

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

  test("最初の盤面から、決まるマスを埋めていくだけで解き切れること", () => {
    const result = fillByDeduction(givens, allRuleIds);

    expect(result).toEqual(solution);
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
      .map((step) => step.cuedDigit === solutionDigit(step.cellIndex));

    expect(result).toEqual([true]);
  });

  test.each(ruleStepCases)(
    "手順 %i の印のマスは、始めた盤面で、手に入れたルールだけで解の数字に決まり、示すまとまりが決め手であること",
    (_, { step, board, earnedRuleIds, expected }) => {
      const result = deduceCell(board, earnedRuleIds, step.cellIndex);

      expect(result).toEqual({
        digit: expected,
        reasonUnits: step.reasonUnits,
      });
    },
  );

  test.each(introducingStepCases)(
    "手順 %i の印のマスは、その手順で示すルールだけで決まり、それまでのルールでは決まらないこと",
    (_, { step, board, earnedRuleIds, expected }) => {
      const earlierRuleIds = earnedRuleIds.filter(
        (ruleId) => ruleId !== step.introducedRuleId,
      );
      const introduced = deduceCell(
        board,
        step.introducedRuleId ? [step.introducedRuleId] : [],
        step.cellIndex,
      );
      const earlier = deduceCell(board, earlierRuleIds, step.cellIndex);

      expect(introduced?.digit).toBe(expected);
      expect(earlier).toBeNull();
    },
  );

  test.each(combiningStepCases)(
    "手順 %i の印のマスは、行・列・ブロックのうち1つや2つだけでは決まらないこと",
    (_, { step, board }) => {
      const partialRuleSets = allRuleIds.flatMap((ruleId, index) => [
        [ruleId],
        ...allRuleIds.slice(index + 1).map((other) => [ruleId, other]),
      ]);

      const result = partialRuleSets.map((ruleIds) =>
        deduceCell(board, ruleIds, step.cellIndex),
      );

      expect(result).toEqual(partialRuleSets.map(() => null));
    },
  );

  test.each(ruleStepCases)(
    "手順 %i の印のマスに解と違う数字を入れると、手に入れたルールで重なりが見えること",
    (_, { step, board, earnedRuleIds, expected }) => {
      const result = NANPURE_DIGITS.filter((digit) => digit !== expected).map(
        (digit) => {
          const next = [...board];
          next[step.cellIndex] = digit;
          return getNanpureTutorialConflictCellIndices(
            { step, earnedRuleIds },
            { board: next, moveCount: 0, lastMove: null },
          ).includes(step.cellIndex);
        },
      );

      expect(result.every(Boolean)).toBe(true);
    },
  );

  test("手順を終えて残るマスは、どれも行・列・ブロックを合わせて解の数字に決まること", () => {
    const remaining = getEmptyCellIndices(releasedBoard);
    const result = remaining.map(
      (cellIndex) => deduceCell(releasedBoard, allRuleIds, cellIndex)?.digit,
    );

    expect(remaining.length).toBeGreaterThan(0);
    expect(result).toEqual(remaining.map(solutionDigit));
  });

  test("手順を終えて残るマスは、どの順に埋めても最後まで決まり続けること", () => {
    const remaining = getEmptyCellIndices(releasedBoard);
    // 残るマスはどれも、行・列・ブロックで解以外の数字がすでに使われているので、ほかのマスを埋めても決まったままになる。
    const result = remaining.map((cellIndex) =>
      getNanpureCandidates(releasedBoard, cellIndex),
    );

    expect(result).toEqual(
      remaining.map((cellIndex) => [solutionDigit(cellIndex)]),
    );
  });
});

describe("nanpureTutorial の進行", () => {
  test("手を引いている間は、印のマスだけを選べること", () => {
    const progress = finishSteps(0);
    const situation = getTutorialSituation(nanpureTutorial, progress);
    const [step] = nanpureTutorial.steps;

    expect(
      isNanpureTutorialCellSelectable(situation, step?.cellIndex ?? -1),
    ).toBe(true);
    expect(isNanpureTutorialCellSelectable(situation, cellAt(1, 1))).toBe(
      false,
    );
  });

  test("手を引いている間は、印のマスのほかへ数字を入れても何も起きないこと", () => {
    const progress = finishSteps(0);

    const result = performTutorialAction(
      nanpureTutorial,
      progress,
      enter(cellAt(1, 1), 3),
    );

    expect(result).toBe(progress);
  });

  test("最初の数字は変えられないこと", () => {
    const progress = finishSteps(nanpureTutorial.steps.length);

    const result = performTutorialAction(
      nanpureTutorial,
      progress,
      enter(cellAt(1, 2), 3),
    );

    expect(result).toBe(progress);
  });

  test("操作の手順では、違う数字を入れても重なりを見せず、印を付け続けること", () => {
    const progress = finishSteps(0);
    const [step] = nanpureTutorial.steps;
    const cellIndex = step?.cellIndex ?? -1;

    const result = performTutorialAction(
      nanpureTutorial,
      progress,
      enter(cellIndex, 1),
    );
    const situation = getTutorialSituation(nanpureTutorial, result);

    expect(result.violated).toBe(false);
    expect(result.stepIndex).toBe(0);
    expect(
      getNanpureTutorialConflictCellIndices(situation, result.boardState),
    ).toEqual([]);
    expect(getNanpureTutorialStepCellIndex(situation, result.boardState)).toBe(
      cellIndex,
    );
  });

  test("行のルールを示した後、行で重なる数字を入れると、どの行に何が重なったかを言うこと", () => {
    const progress = finishSteps(1);
    const step = nanpureTutorial.steps[1];

    const result = performTutorialAction(
      nanpureTutorial,
      progress,
      enter(step?.cellIndex ?? -1, 9),
    );
    const message = getTutorialMessage(nanpureTutorial, result, {
      entry: "selection",
      violationSettled: true,
    });

    expect(result.violated).toBe(true);
    expect(message.headline).toBe("この行には、もう9があります");
  });

  test("列のルールを示した後、行と列の両方で重なる数字を入れると、列の重なりを言うこと", () => {
    const progress = finishSteps(2);

    const result = performTutorialAction(
      nanpureTutorial,
      progress,
      enter(cellAt(7, 1), 4),
    );
    const message = getTutorialMessage(nanpureTutorial, result, {
      entry: "selection",
      violationSettled: true,
    });

    expect(message.headline).toBe("この列には、もう4があります");
  });

  test("手を離した後、前に入れた違う数字と重なる正しい数字を入れると、正しい手として応え、違う数字のマスを直させること", () => {
    const progress = performAll(finishSteps(nanpureTutorial.steps.length), [
      enter(cellAt(2, 2), 6),
      enter(cellAt(2, 6), 6),
    ]);
    const situation = getTutorialSituation(nanpureTutorial, progress);
    const message = getTutorialMessage(nanpureTutorial, progress, {
      entry: "selection",
      violationSettled: true,
    });

    expect(progress.boardState.lastMove?.violated).toBe(false);
    expect(progress.boardState.lastMove?.reasonUnits).not.toEqual([]);
    expect(progress.violated).toBe(true);
    expect(message.headline).toBe("印のマスの数字が違います");
    expect(
      findNanpureTutorialWrongCellIndex(situation, progress.boardState),
    ).toBe(cellAt(2, 2));
  });

  test("違う数字を残したまま空きマスを埋めると、重なりを直させる一言を続けること", () => {
    const released = finishSteps(nanpureTutorial.steps.length);
    const remaining = getEmptyCellIndices(released.boardState.board);
    const progress = performAll(released, [
      enter(cellAt(6, 3), 5),
      ...remaining.map((cellIndex) =>
        enter(cellIndex, solutionDigit(cellIndex)),
      ),
    ]);
    const message = getTutorialMessage(nanpureTutorial, progress, {
      entry: "selection",
      violationSettled: true,
    });

    expect(getEmptyCellIndices(progress.boardState.board)).toEqual([]);
    expect(progress.phase).toBe("playing");
    expect(message.headline).toBe("印のマスの数字が違います");
  });

  test("重なった数字を正しい数字に入れ替えると、次の手順へ進むこと", () => {
    const progress = finishSteps(1);
    const step = nanpureTutorial.steps[1];
    const cellIndex = step?.cellIndex ?? -1;

    const result = performAll(progress, [
      enter(cellIndex, 9),
      enter(cellIndex, solutionDigit(cellIndex)),
    ]);

    expect(result.violated).toBe(false);
    expect(result.stepIndex).toBe(2);
  });

  test("手順を終えると手を離し、残りを埋めると解けること", () => {
    const progress = finishSteps(nanpureTutorial.steps.length);
    const remaining = getEmptyCellIndices(progress.boardState.board);

    const result = performAll(
      progress,
      remaining.map((cellIndex) => enter(cellIndex, solutionDigit(cellIndex))),
    );

    expect(progress.stepIndex).toBe(nanpureTutorial.steps.length);
    expect(progress.earnedRuleIds).toEqual(allRuleIds);
    expect(result.phase).toBe("solved");
  });

  test("手を離した後の手がかりは、まとまりで最後に空いたマスを先に示すこと", () => {
    const progress = finishSteps(nanpureTutorial.steps.length);
    const situation = getTutorialSituation(nanpureTutorial, progress);

    const result = findNanpureTutorialHint(situation, progress.boardState);

    expect(result?.reasonUnits).toHaveLength(1);
    expect(
      deduceCell(progress.boardState.board, allRuleIds, result?.cellIndex ?? -1)
        ?.digit,
    ).toBe(solutionDigit(result?.cellIndex ?? -1));
  });

  test("答えと違う数字があるときの手がかりは、その数字のマスを示すこと", () => {
    const released = finishSteps(nanpureTutorial.steps.length);
    const [cellIndex = -1] = getEmptyCellIndices(released.boardState.board);
    const wrongDigit = solutionDigit(cellIndex) === 1 ? 2 : 1;
    const progress = performAll(released, [enter(cellIndex, wrongDigit)]);
    const situation = getTutorialSituation(nanpureTutorial, progress);

    const result = findNanpureTutorialHint(situation, progress.boardState);

    expect(result).toEqual({ cellIndex, reasonUnits: [] });
  });
});
