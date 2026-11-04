import { getMinesweeperNeighborCellIndices } from "@/games/minesweeper/puzzle/board";
import {
  collectMinesweeperRevealCellIndices,
  getAdjacentMinesweeperMineCount,
  isMinesweeperCleared,
} from "@/games/minesweeper/puzzle/rules";
import type { MinesweeperPuzzleState } from "@/games/minesweeper/puzzle/state";
import { revealMinesweeperCell } from "@/games/minesweeper/puzzle/transitions";
import {
  _private,
  findMinesweeperTutorialHintCellIndex,
  getMinesweeperTutorialStepCellIndices,
  getMinesweeperTutorialVisibleCells,
  type MinesweeperTutorialAction,
  type MinesweeperTutorialBoardState,
  type MinesweeperTutorialRuleId,
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

const {
  board,
  initialRevealedCellIndices,
  safeCellIndices,
  cellAt,
  deduceCells,
} = _private;

type Progress = TutorialProgress<
  MinesweeperTutorialRuleId,
  MinesweeperTutorialBoardState
>;

const allRuleIds = [
  "number",
  "total",
] as const satisfies readonly MinesweeperTutorialRuleId[];

function reveal(cellIndex: number): MinesweeperTutorialAction {
  return { type: "reveal", cellIndex };
}

function flag(cellIndex: number): MinesweeperTutorialAction {
  return { type: "flag", cellIndex };
}

function chord(cellIndex: number): MinesweeperTutorialAction {
  return { type: "chord", cellIndex };
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

/** 最初の `count` 個の手順を、印のマスへ手順どおりの操作をして終える。 */
function finishSteps(count: number): Progress {
  return minesweeperTutorial.steps.slice(0, count).reduce(
    (progress, step) =>
      performAll(
        progress,
        step.cellIndices.map((cellIndex) => ({
          type: step.operation,
          cellIndex,
        })),
      ),
    finishTutorialIntro(startTutorial(minesweeperTutorial)),
  );
}

/** 開いていないマスに地雷の総数だけ地雷を置く置き方のうち、開いた数字すべてに合うもの。 */
function listMinePlacements(revealedCellIndices: readonly number[]): string[] {
  const hidden = Array.from(
    { length: board.rows * board.columns },
    (_, cellIndex) => cellIndex,
  ).filter((cellIndex) => !revealedCellIndices.includes(cellIndex));
  const mineCount = board.mineCellIndices.length;
  const placements: number[][] = [];
  function choose(start: number, chosen: number[]): void {
    if (chosen.length === mineCount) {
      placements.push([...chosen]);
      return;
    }
    for (let index = start; index < hidden.length; index += 1) {
      choose(index + 1, [...chosen, hidden[index] ?? -1]);
    }
  }
  choose(0, []);
  return placements
    .filter((mines) =>
      revealedCellIndices.every(
        (cellIndex) =>
          getMinesweeperNeighborCellIndices(board, cellIndex).filter(
            (neighbor) => mines.includes(neighbor),
          ).length === getAdjacentMinesweeperMineCount(board, cellIndex),
      ),
    )
    .map((mines) => mines.join(","));
}

/** 決まる地雷でないマスを、決まらなくなるまで開く。 */
function revealByDeduction(
  puzzle: MinesweeperPuzzleState,
  ruleIds: readonly MinesweeperTutorialRuleId[],
): MinesweeperPuzzleState {
  let current = puzzle;
  for (;;) {
    const safe = [...deduceCells(current, ruleIds)]
      .filter(
        ([cellIndex, deduction]) =>
          !deduction.mine && !current.revealedCellIndices.includes(cellIndex),
      )
      .map(([cellIndex]) => cellIndex);
    if (safe.length === 0) {
      return current;
    }
    current = safe.reduce(
      (state, cellIndex) => revealMinesweeperCell(board, state, cellIndex),
      current,
    );
  }
}

const ruleStepCases = minesweeperTutorial.steps.map(
  function createStepCase(step, stepIndex) {
    const progress = finishSteps(stepIndex);
    return [
      stepIndex,
      {
        step,
        progress,
        puzzle: progress.boardState.puzzle,
        earnedRuleIds: progress.earnedRuleIds,
      },
    ] as const;
  },
);
const introducingStepCases = ruleStepCases.filter(
  ([, { step }]) => step.introducedRuleId !== null,
);
const ruleCases = minesweeperTutorial.rules.map(({ id }) => id);

/** 手順で印を付けるマスを打つ順の、すべての並べ方。 */
function listOrders(cellIndices: readonly number[]): number[][] {
  if (cellIndices.length <= 1) {
    return [[...cellIndices]];
  }
  return cellIndices.flatMap((cellIndex, index) =>
    listOrders(cellIndices.filter((_, other) => other !== index)).map(
      (rest) => [cellIndex, ...rest],
    ),
  );
}

/** 手順の印のマスを `order` の順に手順どおりに打ち、打ち終えるまでの途中の進行をすべて返す。 */
function listIntermediateProgresses(
  progress: Progress,
  operation: "reveal" | "flag",
  order: readonly number[],
): Progress[] {
  const progresses: Progress[] = [];
  let current = progress;
  for (const cellIndex of order.slice(0, -1)) {
    current = performTutorialAction(minesweeperTutorial, current, {
      type: operation,
      cellIndex,
    });
    progresses.push(current);
  }
  return progresses;
}

/** 手順と違う操作。開かせるマスに旗を置く、旗を置かせるマスを開く。 */
const otherOperations = {
  reveal: "flag",
  flag: "reveal",
} as const;

describe("minesweeperTutorial の盤面", () => {
  const releasedPuzzle = finishSteps(minesweeperTutorial.steps.length)
    .boardState.puzzle;
  const startPuzzle = minesweeperTutorial.start().puzzle;
  const revealedFromCorner = collectMinesweeperRevealCellIndices(board, [
    cellAt(1, 1),
  ]);
  const goalRevealed = minesweeperTutorial.goal().puzzle.revealedCellIndices;
  const deductionCases = [
    ...ruleStepCases.map(
      ([stepIndex, { puzzle, earnedRuleIds }]) =>
        [`手順 ${stepIndex} を始めた盤面`, puzzle, earnedRuleIds] as const,
    ),
    ["手を離した盤面", releasedPuzzle, allRuleIds] as const,
  ];

  test("始まりの盤面は、本番と同じく1マスから続けて開いた形であること", () => {
    const result = minesweeperTutorial.start().puzzle.revealedCellIndices;

    expect(result).toEqual(revealedFromCorner);
  });

  test("どの置き方でも地雷でないマスを開いていくと、推測せずに地雷の置き方が1つに決まること", () => {
    let revealed = [...initialRevealedCellIndices];
    let placements = listMinePlacements(revealed);
    for (;;) {
      const candidates = placements.map((placement) =>
        placement.split(",").map(Number),
      );
      const safe = Array.from(
        { length: board.rows * board.columns },
        (_, cellIndex) => cellIndex,
      ).filter(
        (cellIndex) =>
          !revealed.includes(cellIndex) &&
          candidates.every((mines) => !mines.includes(cellIndex)),
      );
      if (safe.length === 0) {
        break;
      }
      revealed = [...revealed, ...safe];
      placements = listMinePlacements(revealed);
    }

    expect(placements).toEqual([board.mineCellIndices.join(",")]);
    expect(revealed).toHaveLength(safeCellIndices.length);
  });

  test("開いていない地雷でないマスは、開いても周りが続けて開かないこと", () => {
    const result = safeCellIndices
      .filter((cellIndex) => !initialRevealedCellIndices.includes(cellIndex))
      .map((cellIndex) => getAdjacentMinesweeperMineCount(board, cellIndex));

    expect(result.every((count) => count > 0)).toBe(true);
  });

  test("導入で見せる解き終えた盤面は、地雷でないマスがすべて開き、地雷を明かしていること", () => {
    const goal = minesweeperTutorial.goal();
    const cleared = isMinesweeperCleared(board, goal.puzzle);
    const visibleCells = getMinesweeperTutorialVisibleCells(goal);
    const mineStates = board.mineCellIndices.map(
      (cellIndex) => visibleCells[cellIndex]?.state,
    );

    expect(cleared).toBe(true);
    expect(mineStates).toEqual(["mine", "mine", "mine"]);
  });

  test("数字の決まりだけでは解き切れず、地雷の総数の決まりも使うと解き切れること", () => {
    const byNumber = revealByDeduction(startPuzzle, ["number"]);
    const byAll = revealByDeduction(startPuzzle, allRuleIds);

    expect(isMinesweeperCleared(board, byNumber)).toBe(false);
    expect(byNumber.steppedMineCellIndices).toEqual([]);
    expect(isMinesweeperCleared(board, byAll)).toBe(true);
    expect(byAll.steppedMineCellIndices).toEqual([]);
  });

  test.each(ruleStepCases)(
    "手順 %i の印のマスは、始めた盤面で、手に入れたルールだけで手順の操作どおりに決まること",
    (_, { step, puzzle, earnedRuleIds }) => {
      const deductions = deduceCells(puzzle, earnedRuleIds);

      const result = step.cellIndices.map(
        (cellIndex) => deductions.get(cellIndex)?.mine ?? null,
      );

      expect(result).toEqual(
        step.cellIndices.map(() => step.operation === "flag"),
      );
    },
  );

  test.each(ruleStepCases)(
    "手順 %i の始まりから示す決め手は、印のマスを決めた数字と、その読みに使った地雷のマスと同じであること",
    (_, { step, puzzle, earnedRuleIds }) => {
      const deductions = deduceCells(puzzle, earnedRuleIds);

      const result = [
        ...new Set(
          step.cellIndices.flatMap(
            (cellIndex) => deductions.get(cellIndex)?.reasonCellIndices ?? [],
          ),
        ),
      ].sort((left, right) => left - right);

      expect(result).toEqual(step.reasonCellIndices);
    },
  );

  test.each(ruleStepCases)(
    "手順 %i の印のマスへの操作は、ゴールの盤面と一致すること",
    (_, { step }) => {
      const result = step.cellIndices.map((cellIndex) =>
        goalRevealed.includes(cellIndex) ? "reveal" : "flag",
      );

      expect(result).toEqual(step.cellIndices.map(() => step.operation));
    },
  );

  test.each(ruleStepCases)(
    "手順 %i の印のマスをどの順で打っても、打ち終えるまでの途中の盤面で地雷を踏まず、旗は地雷のマスにだけあること",
    (_, { step, progress }) => {
      const result = listOrders(step.cellIndices).flatMap((order) =>
        listIntermediateProgresses(progress, step.operation, order).map(
          ({ stepIndex, violated, boardState: { puzzle } }) => ({
            stepIndex,
            violated,
            steppedMineCellIndices: puzzle.steppedMineCellIndices,
            wrongFlagCellIndices: puzzle.flaggedCellIndices.filter(
              (cellIndex) => !board.mineCellIndices.includes(cellIndex),
            ),
          }),
        ),
      );

      expect(result).toEqual(
        result.map(() => ({
          stepIndex: progress.stepIndex,
          violated: false,
          steppedMineCellIndices: [],
          wrongFlagCellIndices: [],
        })),
      );
    },
  );

  test.each(ruleStepCases)(
    "手順 %i の印のマスに手順と違う操作をしても、盤面を変えないこと",
    (_, { step, progress }) => {
      const result = step.cellIndices.map((cellIndex) =>
        performTutorialAction(minesweeperTutorial, progress, {
          type: otherOperations[step.operation],
          cellIndex,
        }),
      );

      expect(result).toEqual(step.cellIndices.map(() => progress));
    },
  );

  test.each(ruleCases)(
    "ルール %s は、1つ以上の手順で印のマスを決める決め手になること",
    (ruleId) => {
      const result = ruleStepCases.filter(
        ([, { step, puzzle, earnedRuleIds }]) => {
          const withoutRule = deduceCells(
            puzzle,
            earnedRuleIds.filter((earned) => earned !== ruleId),
          );
          return step.cellIndices.some(
            (cellIndex) => !withoutRule.has(cellIndex),
          );
        },
      );

      expect(result.length).toBeGreaterThan(0);
    },
  );

  test("地雷の総数を示すのは、地雷の総数のルールを示す手順だけであること", () => {
    const result = minesweeperTutorial.steps.map(
      (step) => step.reasonMineCount,
    );

    expect(result).toEqual(
      minesweeperTutorial.steps.map(
        (step) => step.introducedRuleId === "total",
      ),
    );
  });

  test.each(introducingStepCases)(
    "手順 %i の印のマスは、それまでのルールでは決まらないこと",
    (_, { step, puzzle, earnedRuleIds }) => {
      const earlierRuleIds = earnedRuleIds.filter(
        (ruleId) => ruleId !== step.introducedRuleId,
      );
      const deductions = deduceCells(puzzle, earlierRuleIds);

      const result = step.cellIndices.filter((cellIndex) =>
        deductions.has(cellIndex),
      );

      expect(result).toEqual([]);
    },
  );

  test.each(deductionCases)(
    "%sで、手に入れたルールで決まるとしたマスは、開いた数字と地雷の総数に合うどの置き方でも、そのとおりであること",
    (_, puzzle, ruleIds) => {
      const placements = listMinePlacements(puzzle.revealedCellIndices).map(
        (placement) => placement.split(",").map(Number),
      );

      const result = [...deduceCells(puzzle, ruleIds)]
        .filter(([cellIndex, { mine }]) =>
          placements.some((mines) => mines.includes(cellIndex) !== mine),
        )
        .map(([cellIndex]) => cellIndex);

      expect(placements.length).toBeGreaterThan(0);
      expect(result).toEqual([]);
    },
  );

  test("手順を終えると開いていない地雷でないマスが残り、2つのルールで決まるマスを順に開いて解き切れること", () => {
    const remaining = safeCellIndices.filter(
      (cellIndex) => !releasedPuzzle.revealedCellIndices.includes(cellIndex),
    );

    const result = revealByDeduction(releasedPuzzle, allRuleIds);

    expect(remaining.length).toBeGreaterThan(1);
    expect(isMinesweeperCleared(board, result)).toBe(true);
    expect(result.steppedMineCellIndices).toEqual([]);
  });
});

describe("minesweeperTutorial.perform", () => {
  const started = finishTutorialIntro(startTutorial(minesweeperTutorial));
  const afterFirstStep = finishSteps(1);
  const afterSecondStep = finishSteps(2);
  const released = finishSteps(minesweeperTutorial.steps.length);

  test("手を引いている間は、印の無いマスへの操作で盤面を変えないこと", () => {
    const result = performAll(started, [
      reveal(cellAt(4, 3)),
      flag(cellAt(5, 2)),
    ]);

    expect(result).toBe(started);
  });

  test("旗を置かせる印のマスは、開く操作を受け付けず、地雷を踏ませないこと", () => {
    const result = performAll(started, [reveal(cellAt(3, 3))]);

    expect(result).toBe(started);
  });

  test("旗を置かせる印のマスに旗を置くと、次の手順へ進み、置いたマスを手順どおりになったマスとして返すこと", () => {
    const result = performAll(started, [flag(cellAt(3, 3))]);

    expect(result.stepIndex).toBe(1);
    expect(result.boardState.puzzle.flaggedCellIndices).toEqual([cellAt(3, 3)]);
    expect(result.boardState.lastMove).toEqual({
      cellIndex: cellAt(3, 3),
      steppedMine: false,
      fittedCellIndices: [cellAt(3, 3)],
    });
  });

  test("開かせる印のマスは、旗を置く操作を受け付けないこと", () => {
    const result = performAll(afterFirstStep, [flag(cellAt(4, 3))]);

    expect(result).toBe(afterFirstStep);
  });

  test("旗で数がそろった1を押して、印のマスをまとめて開いても次の手順へ進み、手順どおりになったのは押した1ではなく開いた印のマスとすること", () => {
    const result = performAll(afterFirstStep, [chord(cellAt(3, 2))]);

    expect(result.stepIndex).toBe(2);
    expect(result.boardState.puzzle.revealedCellIndices).toContain(
      cellAt(4, 3),
    );
    expect(result.boardState.lastMove?.fittedCellIndices).toEqual([
      cellAt(4, 3),
    ]);
  });

  test("旗の数がそろっていない数字を押しても、盤面を変えないこと", () => {
    const result = performAll(afterFirstStep, [chord(cellAt(3, 4))]);

    expect(result).toBe(afterFirstStep);
  });

  test("開かせる印のマスを開くと、次の手順へ進み、地雷の総数のルールを手に入れること", () => {
    const result = performAll(afterFirstStep, [reveal(cellAt(4, 3))]);

    expect(result.stepIndex).toBe(2);
    expect(result.earnedRuleIds).toEqual(["number", "total"]);
  });

  test("地雷の総数で決まる3マスは、3つとも開くまで手順を進めないこと", () => {
    const once = performAll(afterSecondStep, [reveal(cellAt(4, 5))]);
    const all = performAll(once, [reveal(cellAt(5, 1)), reveal(cellAt(5, 5))]);

    expect(once.stepIndex).toBe(2);
    expect(all.stepIndex).toBe(minesweeperTutorial.steps.length);
  });

  test("手を離した後は、旗の正誤を判定せず、旗を外せること", () => {
    const placed = performAll(released, [flag(cellAt(5, 3))]);
    const removed = performAll(placed, [flag(cellAt(5, 3))]);

    expect(placed.violated).toBe(false);
    expect(placed.boardState.puzzle.flaggedCellIndices).toContain(cellAt(5, 3));
    expect(removed.boardState.puzzle.flaggedCellIndices).not.toContain(
      cellAt(5, 3),
    );
  });

  test("手を離した後に地雷を踏むと、違反として盤面に残し、続けて解き切れること", () => {
    const stepped = performAll(released, [reveal(cellAt(4, 4))]);
    const message = getTutorialMessage(minesweeperTutorial, stepped, {
      entry: "home",
      violationSettled: true,
    });
    const solved = performAll(stepped, [
      reveal(cellAt(5, 3)),
      reveal(cellAt(5, 4)),
    ]);

    expect(stepped.violated).toBe(true);
    expect(stepped.boardState.puzzle.steppedMineCellIndices).toEqual([
      cellAt(4, 4),
    ]);
    expect(message.headline).toBe("地雷を踏みました");
    expect(solved.phase).toBe("solved");
  });

  test("手を離した後は、旗で数がそろった数字を押すと周りをまとめて開けること", () => {
    const result = performAll(released, [
      flag(cellAt(5, 2)),
      chord(cellAt(4, 2)),
    ]);

    expect(result.boardState.puzzle.revealedCellIndices).toContain(
      cellAt(5, 3),
    );
  });

  test("残りの地雷でないマスをすべて開くと解けること", () => {
    const result = performAll(released, [
      reveal(cellAt(5, 3)),
      reveal(cellAt(5, 4)),
    ]);

    expect(result.phase).toBe("solved");
  });
});

describe("findMinesweeperTutorialHintCellIndex", () => {
  const released = finishSteps(minesweeperTutorial.steps.length);
  const flaggedSafe = performAll(released, [flag(cellAt(5, 3))]);
  const flaggedAllSafe = performAll(flaggedSafe, [flag(cellAt(5, 4))]);

  test("手を離した盤面では、数字で決まる地雷でないマスを返すこと", () => {
    const result = findMinesweeperTutorialHintCellIndex(
      getTutorialSituation(minesweeperTutorial, released),
      released.boardState,
    );

    expect([cellAt(5, 3), cellAt(5, 4)]).toContain(result);
  });

  test("地雷でないマスに旗を置いても、ほかに決まるマスがあればそちらを返すこと", () => {
    const result = findMinesweeperTutorialHintCellIndex(
      getTutorialSituation(minesweeperTutorial, flaggedSafe),
      flaggedSafe.boardState,
    );

    expect(result).toBe(cellAt(5, 4));
  });

  test("決まるマスがすべて旗の下にあれば、旗のマスを返すこと", () => {
    const result = findMinesweeperTutorialHintCellIndex(
      getTutorialSituation(minesweeperTutorial, flaggedAllSafe),
      flaggedAllSafe.boardState,
    );

    expect([cellAt(5, 3), cellAt(5, 4)]).toContain(result);
  });
});

describe("getMinesweeperTutorialStepCellIndices", () => {
  const partlyOpened = performAll(finishSteps(2), [reveal(cellAt(5, 1))]);

  test("手順の印のうち、まだ手順どおりになっていないマスを返すこと", () => {
    const result = getMinesweeperTutorialStepCellIndices(
      getTutorialSituation(minesweeperTutorial, partlyOpened),
      partlyOpened.boardState,
    );

    expect(result).toEqual([cellAt(4, 5), cellAt(5, 5)]);
  });
});
