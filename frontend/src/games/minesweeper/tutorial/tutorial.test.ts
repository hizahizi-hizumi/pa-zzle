import { getMinesweeperNeighborCellIndices } from "@/games/minesweeper/puzzle/board";
import {
  collectMinesweeperRevealCellIndices,
  getAdjacentMinesweeperMineCount,
  isMinesweeperCleared,
} from "@/games/minesweeper/puzzle/rules";
import type { MinesweeperPuzzleState } from "@/games/minesweeper/puzzle/state";
import {
  _private,
  adjustMinesweeperTutorialMessage,
  findMinesweeperTutorialHintCellIndex,
  getMinesweeperTutorialCells,
  getMinesweeperTutorialCue,
  type MinesweeperTutorialAction,
  type MinesweeperTutorialBoardState,
  type MinesweeperTutorialRuleId,
  type MinesweeperTutorialStep,
  minesweeperTutorial,
} from "@/games/minesweeper/tutorial/tutorial";
import {
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

const { board, initialRevealedCellIndices, deduceCells } = _private;

type Progress = TutorialProgress<
  MinesweeperTutorialRuleId,
  MinesweeperTutorialBoardState
>;

const allRuleIds = [
  "number",
  "cascade",
  "chord",
  "total",
] as const satisfies readonly MinesweeperTutorialRuleId[];

/** 1始まりの行・列で書いたマス。 */
function cellAt(row: number, column: number): number {
  return (row - 1) * board.columns + (column - 1);
}

function performAll(
  progress: Progress,
  actions: readonly MinesweeperTutorialAction[],
): Progress {
  return actions.reduce(
    (current, action) =>
      performTutorialAction(minesweeperTutorial, current, action),
    progress,
  );
}

/** 手順の操作に合わせて切り替えてから、印のマスを操作する。 */
function getStepActions(
  step: MinesweeperTutorialStep,
): MinesweeperTutorialAction[] {
  if (step.operation === "change-mode") {
    return [{ type: "change-mode", mode: step.mode }];
  }
  return [
    {
      type: "change-mode",
      mode: step.operation === "flag" ? "flag" : "reveal",
    },
    { type: step.operation, cellIndex: step.cellIndex },
  ];
}

/** マスを操作する手順の、操作するマス。 */
function getStepCellIndex(step: MinesweeperTutorialStep | undefined): number {
  if (step === undefined || step.operation === "change-mode") {
    throw new Error("cell step is expected");
  }
  return step.cellIndex;
}

/** 最初の `count` 個の手順を終える。 */
function finishSteps(count: number): Progress {
  return minesweeperTutorial.steps
    .slice(0, count)
    .reduce(
      (progress, step) => performAll(progress, getStepActions(step)),
      finishTutorialIntro(startTutorial(minesweeperTutorial)),
    );
}

/** 手順のマスが、手順の操作どおりに決まっていること。まとめて開く手順は、開くマスが全部開けると決まっていること。 */
function isStepDeduced(
  step: MinesweeperTutorialStep,
  puzzle: MinesweeperPuzzleState,
  ruleIds: readonly MinesweeperTutorialRuleId[],
): boolean {
  const { mineCellIndices, safeCellIndices } = deduceCells(puzzle, ruleIds);
  switch (step.operation) {
    case "change-mode":
      return false;
    case "flag":
      return mineCellIndices.has(step.cellIndex);
    case "reveal":
      return safeCellIndices.has(step.cellIndex);
    case "chord":
      return getMinesweeperNeighborCellIndices(board, step.cellIndex)
        .filter(
          (cellIndex) =>
            !puzzle.revealedCellIndices.includes(cellIndex) &&
            !puzzle.flaggedCellIndices.includes(cellIndex),
        )
        .every((cellIndex) => safeCellIndices.has(cellIndex));
  }
}

/** 分かった地雷に旗を置き、開けると分かったマスを開く手を、分からなくなるまで続ける。 */
function solveByDeduction(
  puzzle: MinesweeperPuzzleState,
  ruleIds: readonly MinesweeperTutorialRuleId[],
): MinesweeperPuzzleState {
  let current = puzzle;
  for (;;) {
    const { mineCellIndices, safeCellIndices } = deduceCells(current, ruleIds);
    if (safeCellIndices.size === 0) {
      return current;
    }
    current = {
      ...current,
      flaggedCellIndices: [...mineCellIndices],
      revealedCellIndices: [
        ...new Set([
          ...current.revealedCellIndices,
          ...collectMinesweeperRevealCellIndices(board, [...safeCellIndices]),
        ]),
      ],
    };
  }
}

const operationStepCount = minesweeperTutorial.steps.findIndex(
  (step) => step.introducedRuleId !== null,
);
/** 手順ごとの、始めた盤面と手に入れたルール。 */
const ruleStepCases = minesweeperTutorial.steps
  .map(function createStepCase(step, stepIndex) {
    const progress = finishSteps(stepIndex);
    return [
      stepIndex,
      {
        step,
        puzzle: progress.boardState.puzzle,
        earnedRuleIds: progress.earnedRuleIds,
      },
    ] as const;
  })
  .slice(operationStepCount);
const deducingRuleIds = [
  "number",
  "total",
] as const satisfies readonly MinesweeperTutorialRuleId[];
const deducingStepCases = ruleStepCases.filter(([, { step }]) =>
  deducingRuleIds.some((ruleId) => ruleId === step.introducedRuleId),
);

describe("minesweeperTutorial の盤面", () => {
  const start = minesweeperTutorial.start().puzzle;
  const released = finishSteps(minesweeperTutorial.steps.length).boardState
    .puzzle;

  test("6×6 に地雷が4つで、最初は周りに地雷が無いマスから続けて開いた範囲が開いていること", () => {
    const result = {
      size: [board.rows, board.columns],
      mineCount: board.mineCellIndices.length,
      revealed: start.revealedCellIndices,
    };

    expect(result).toEqual({
      size: [6, 6],
      mineCount: 4,
      revealed: collectMinesweeperRevealCellIndices(board, [cellAt(1, 5)]),
    });
  });

  test("最初の盤面から、数字と地雷の数を当てはめるだけで解き切れること", () => {
    const result = solveByDeduction(start, allRuleIds);

    expect(isMinesweeperCleared(board, result)).toBe(true);
  });

  test("導入で見せる解き終えた盤面は、地雷ではないマスがすべて開き、地雷を見せていること", () => {
    const goal = minesweeperTutorial.goal();

    const cleared = isMinesweeperCleared(board, goal.puzzle);
    const mines = getMinesweeperTutorialCells(goal).flatMap((cell, index) =>
      cell.state === "mine" ? [index] : [],
    );

    expect(cleared).toBe(true);
    expect(mines).toEqual(board.mineCellIndices);
  });

  test("最初の手順は、開いた数字に接したマスを開くこと", () => {
    const [first] = minesweeperTutorial.steps;

    const result = {
      operation: first?.operation,
      touchesRevealed: getMinesweeperNeighborCellIndices(
        board,
        getStepCellIndex(first),
      ).some((cellIndex) => initialRevealedCellIndices.includes(cellIndex)),
    };

    expect(result).toEqual({ operation: "reveal", touchesRevealed: true });
  });

  test.each(ruleStepCases)(
    "手順 %i の印のマスは、始めた盤面で、手に入れたルールだけで決まること",
    (_, { step, puzzle, earnedRuleIds }) => {
      const result = isStepDeduced(step, puzzle, earnedRuleIds);

      expect(result).toBe(true);
    },
  );

  test.each(deducingStepCases)(
    "手順 %i の印のマスは、その手順で示すルールが無いと決まらないこと",
    (_, { step, puzzle, earnedRuleIds }) => {
      const earlierRuleIds = earnedRuleIds.filter(
        (ruleId) => ruleId !== step.introducedRuleId,
      );

      const result = isStepDeduced(step, puzzle, earlierRuleIds);

      expect(result).toBe(false);
    },
  );

  describe("続けて開くことを示す手順", () => {
    const step = minesweeperTutorial.steps.find(
      (candidate) => candidate.introducedRuleId === "cascade",
    );

    test("周りに地雷が無いマスを開かせ、ほかのマスも続けて開くこと", () => {
      const count = getAdjacentMinesweeperMineCount(
        board,
        getStepCellIndex(step),
      );
      const opened = collectMinesweeperRevealCellIndices(board, [
        getStepCellIndex(step),
      ]);

      expect(count).toBe(0);
      expect(opened.length).toBeGreaterThan(1);
    });
  });

  describe("まとめて開くことを示す手順", () => {
    const stepIndex = minesweeperTutorial.steps.findIndex(
      (candidate) => candidate.introducedRuleId === "chord",
    );

    test("押した数字の周りで、閉じたマスを2つ以上まとめて開くこと", () => {
      const before = finishSteps(stepIndex).boardState.puzzle;
      const after = finishSteps(stepIndex + 1).boardState.puzzle;

      const opened =
        after.revealedCellIndices.length - before.revealedCellIndices.length;

      expect(opened).toBeGreaterThanOrEqual(2);
    });
  });

  test("手順を終えると閉じたマスが残り、数字だけを当てはめて解き切れること", () => {
    const result = solveByDeduction(released, ["number"]);

    expect(isMinesweeperCleared(board, released)).toBe(false);
    expect(isMinesweeperCleared(board, result)).toBe(true);
  });
});

describe("minesweeperTutorial.perform", () => {
  describe("手を引いている間", () => {
    let progress: Progress;

    beforeEach(() => {
      progress = finishSteps(2);
    });

    test("印のマスでないマスを開く手、手順と違う操作、手順で操作させるマスへの旗を受け付けないこと", () => {
      const result = performAll(progress, [
        { type: "reveal", cellIndex: cellAt(3, 1) },
        { type: "reveal", cellIndex: cellAt(2, 1) },
        { type: "flag", cellIndex: cellAt(3, 4) },
        { type: "flag", cellIndex: cellAt(6, 5) },
        { type: "flag", cellIndex: cellAt(4, 4) },
      ]);

      expect(result).toBe(progress);
    });

    test("後の手順に関わらないマスには旗を置いて外せ、手順は進まないこと", () => {
      const placed = performAll(progress, [
        { type: "flag", cellIndex: cellAt(5, 5) },
      ]);
      const removed = performAll(placed, [
        { type: "flag", cellIndex: cellAt(5, 5) },
      ]);

      expect(placed.boardState.puzzle.flaggedCellIndices).toEqual([
        cellAt(5, 5),
      ]);
      expect(removed.boardState.puzzle.flaggedCellIndices).toEqual([]);
      expect(removed.stepIndex).toBe(2);
    });

    test("切り替えは受け付け、開くに戻してから長押しで印のマスに旗を置いても次の手順へ進むこと", () => {
      const switched = performAll(progress, [
        { type: "change-mode", mode: "reveal" },
      ]);
      const flagged = performAll(switched, [
        { type: "flag", cellIndex: cellAt(2, 1) },
      ]);

      expect(switched.boardState.mode).toBe("reveal");
      expect(switched.stepIndex).toBe(2);
      expect(flagged.stepIndex).toBe(3);
    });
  });

  describe("手を離した後", () => {
    let progress: Progress;

    beforeEach(() => {
      progress = finishSteps(minesweeperTutorial.steps.length);
    });

    test("地雷を開くと踏んだ地雷として残り、ルールに合わない手として違反の一言を出すこと", () => {
      const result = performAll(progress, [
        { type: "reveal", cellIndex: cellAt(4, 5) },
      ]);
      const message = getTutorialMessage(minesweeperTutorial, result, {
        entry: "selection",
        violationSettled: true,
      });

      expect(result.violated).toBe(true);
      expect(result.boardState.puzzle.steppedMineCellIndices).toEqual([
        cellAt(4, 5),
      ]);
      expect(message.headline).toBe("地雷を踏みました");
    });

    test("地雷を踏んでも、残りを開くと解けること", () => {
      const result = performAll(progress, [
        { type: "reveal", cellIndex: cellAt(4, 5) },
        { type: "reveal", cellIndex: cellAt(4, 6) },
        { type: "reveal", cellIndex: cellAt(6, 6) },
      ]);

      expect(result.phase).toBe("solved");
    });

    test("手が止まったときに示すマスは、開けると分かる地雷ではないマスであること", () => {
      const situation = getTutorialSituation(minesweeperTutorial, progress);

      const result = findMinesweeperTutorialHintCellIndex(
        situation,
        progress.boardState,
      );

      expect(
        [cellAt(5, 5), cellAt(5, 6), cellAt(6, 6)].includes(result ?? -1),
      ).toBe(true);
    });
  });
});

describe("getMinesweeperTutorialCue", () => {
  describe("旗へ切り替える手順の場合", () => {
    const progress = finishSteps(1);
    const situation = getTutorialSituation(minesweeperTutorial, progress);

    test("切り替えのボタンだけに印を付けること", () => {
      const cue = getMinesweeperTutorialCue(situation, progress.boardState);

      expect(cue).toEqual({ modeCued: true, cellIndex: null });
    });
  });

  describe("旗に切り替えた後、開くに戻した場合", () => {
    const progress = performAll(finishSteps(2), [
      { type: "change-mode", mode: "reveal" },
    ]);
    const situation = getTutorialSituation(minesweeperTutorial, progress);

    test("切り替えのボタンと印のマスに印を付け、手順の補足はそのまま言うこと", () => {
      const cue = getMinesweeperTutorialCue(situation, progress.boardState);
      const message = adjustMinesweeperTutorialMessage(
        situation,
        progress.boardState,
        getTutorialMessage(minesweeperTutorial, progress, {
          entry: "selection",
          violationSettled: true,
        }),
      );

      expect(cue).toEqual({ modeCued: true, cellIndex: cellAt(2, 1) });
      expect(message.detail).toBe("長押しでも旗を置けます");
    });
  });

  describe("旗に切り替えたまま旗を置く手順に進んだ場合", () => {
    const progress = finishSteps(2);
    const situation = getTutorialSituation(minesweeperTutorial, progress);

    test("印のマスだけに印を付け、手順の補足を言うこと", () => {
      const cue = getMinesweeperTutorialCue(situation, progress.boardState);
      const message = adjustMinesweeperTutorialMessage(
        situation,
        progress.boardState,
        getTutorialMessage(minesweeperTutorial, progress, {
          entry: "selection",
          violationSettled: true,
        }),
      );

      expect(cue).toEqual({ modeCued: false, cellIndex: cellAt(2, 1) });
      expect(message.detail).toBe("長押しでも旗を置けます");
    });
  });
});
