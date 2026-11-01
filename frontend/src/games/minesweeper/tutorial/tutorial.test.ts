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
  return [
    {
      type: "change-mode",
      mode: step.operation === "flag" ? "flag" : "reveal",
    },
    { type: step.operation, cellIndex: step.cellIndex },
  ];
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
        first?.cellIndex ?? 0,
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
        step?.cellIndex ?? 0,
      );
      const opened = collectMinesweeperRevealCellIndices(board, [
        step?.cellIndex ?? 0,
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
      progress = finishSteps(1);
    });

    test("印のマスでないマスへの操作と、手順と違う操作を受け付けないこと", () => {
      const result = performAll(progress, [
        { type: "flag", cellIndex: cellAt(3, 1) },
        { type: "reveal", cellIndex: cellAt(2, 1) },
      ]);

      expect(result).toBe(progress);
    });

    test("切り替えは受け付け、切り替えずに長押しで印のマスに旗を置いても次の手順へ進むこと", () => {
      const switched = performAll(progress, [
        { type: "change-mode", mode: "flag" },
      ]);
      const flagged = performAll(progress, [
        { type: "flag", cellIndex: cellAt(2, 1) },
      ]);

      expect(switched.boardState.mode).toBe("flag");
      expect(switched.stepIndex).toBe(1);
      expect(flagged.stepIndex).toBe(2);
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
  describe("旗を置く手順で、開くに切り替えている場合", () => {
    const progress = finishSteps(1);
    const situation = getTutorialSituation(minesweeperTutorial, progress);

    test("切り替えのボタンに印を付け、補足で切り替え方を言うこと", () => {
      const cue = getMinesweeperTutorialCue(situation, progress.boardState);
      const message = adjustMinesweeperTutorialMessage(
        situation,
        progress.boardState,
        getTutorialMessage(minesweeperTutorial, progress, {
          entry: "selection",
          violationSettled: true,
        }),
      );

      expect(cue).toEqual({ target: "mode" });
      expect(message.detail).toBe("上のボタンで旗に切り替えます");
    });
  });

  describe("旗に切り替えた場合", () => {
    const progress = performAll(finishSteps(1), [
      { type: "change-mode", mode: "flag" },
    ]);
    const situation = getTutorialSituation(minesweeperTutorial, progress);

    test("印のマスに印を付け、手順の補足を言うこと", () => {
      const cue = getMinesweeperTutorialCue(situation, progress.boardState);
      const message = adjustMinesweeperTutorialMessage(
        situation,
        progress.boardState,
        getTutorialMessage(minesweeperTutorial, progress, {
          entry: "selection",
          violationSettled: true,
        }),
      );

      expect(cue).toEqual({ target: "cell", cellIndex: cellAt(2, 1) });
      expect(message.detail).toBe("地雷のマスには旗を置きます");
    });
  });
});
