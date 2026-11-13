import { minesweeperDifficultyBoardRanges } from "@/games/minesweeper/difficulty";
import { getMinesweeperNeighborCellIndices } from "@/games/minesweeper/puzzle/board";
import {
  collectMinesweeperRevealCellIndices,
  getAdjacentMinesweeperMineCount,
  isMinesweeperCleared,
} from "@/games/minesweeper/puzzle/rules";
import type { MinesweeperPuzzleState } from "@/games/minesweeper/puzzle/state";
import {
  _private,
  describeMinesweeperTutorialHint,
  findMinesweeperTutorialHint,
  getMinesweeperTutorialProgressRatio,
  getMinesweeperTutorialStepCellIndices,
  getMinesweeperTutorialStepSpotlitCellIndices,
  getMinesweeperTutorialVisibleCells,
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

const { board, safeCellIndices, cellAt, deduceCells } = _private;

const { steps, rules } = minesweeperTutorial;

type Progress = TutorialProgress<
  MinesweeperTutorialRuleId,
  MinesweeperTutorialBoardState
>;

const allRuleIds = rules.map(({ id }) => id);

function reveal(cellIndex: number): MinesweeperTutorialAction {
  return { type: "reveal", cellIndex };
}

function flag(cellIndex: number): MinesweeperTutorialAction {
  return { type: "flag", cellIndex };
}

function chord(cellIndex: number): MinesweeperTutorialAction {
  return { type: "chord", cellIndex };
}

function perform(
  progress: Progress,
  ...actions: readonly MinesweeperTutorialAction[]
): Progress {
  return actions.reduce(
    (current, action) =>
      performTutorialAction(minesweeperTutorial, current, action),
    progress,
  );
}

function stepActions(
  step: MinesweeperTutorialStep,
): MinesweeperTutorialAction[] {
  return step.cellIndices.map((cellIndex) => ({
    type: step.operation,
    cellIndex,
  }));
}

const startedProgress = finishTutorialIntro(startTutorial(minesweeperTutorial));

function finishSteps(count: number): Progress {
  return steps
    .slice(0, count)
    .reduce(
      (progress, step) => perform(progress, ...stepActions(step)),
      startedProgress,
    );
}

const releasedProgress = finishSteps(steps.length);

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

function solveByDeduction(
  puzzle: MinesweeperPuzzleState,
  ruleIds: readonly MinesweeperTutorialRuleId[],
): MinesweeperPuzzleState {
  const deductions = deduceCells(puzzle, ruleIds);
  const safe = [...deductions]
    .filter(([, deduction]) => !deduction.mine)
    .map(([cellIndex]) => cellIndex);
  return {
    ...puzzle,
    revealedCellIndices: [
      ...new Set([
        ...puzzle.revealedCellIndices,
        ...collectMinesweeperRevealCellIndices(board, safe),
      ]),
    ],
  };
}

/** 盤面の数字1つが、`cellIndex` を `mine` のとおりに、`knownMines` を使って決めるか。 */
function decides(
  puzzle: MinesweeperPuzzleState,
  numberCellIndex: number,
  cellIndex: number,
  mine: boolean,
  knownMines: readonly number[],
): boolean {
  const closed = getMinesweeperNeighborCellIndices(
    board,
    numberCellIndex,
  ).filter((neighbor) => !puzzle.revealedCellIndices.includes(neighbor));
  const mineCount = getAdjacentMinesweeperMineCount(board, numberCellIndex);
  if (!closed.includes(cellIndex)) {
    return false;
  }
  return mine
    ? closed.length === mineCount
    : closed.filter((neighbor) => knownMines.includes(neighbor)).length ===
        mineCount;
}

const stepCases = steps.map(
  (step, stepIndex) => [stepIndex, step, finishSteps(stepIndex)] as const,
);
const ruleStepCases = stepCases.filter(
  ([, step]) => step.introducedRuleId !== null,
);

/** ルールを伝える手順と、その手順を始めたときの切り替え（前の手順の操作）。 */
const thoughtlessCases = ruleStepCases.map(
  ([stepIndex, step, progress]) =>
    [
      stepIndex,
      step,
      progress,
      steps[stepIndex - 1]?.operation ?? "reveal",
    ] as const,
);

/** 手順を終えるまでに受け付ける道筋ごとの、手を離した盤面。 */
const releasedCases = [
  ["2つの旗を置き、3マスを1つずつ開いた", releasedProgress],
  [
    "1つ目の地雷を踏んでから旗を置いた",
    perform(
      finishSteps(1),
      reveal(cellAt(2, 5)),
      flag(cellAt(4, 5)),
      ...stepActions(steps[2] as MinesweeperTutorialStep),
    ),
  ],
  [
    "2つ目の地雷を踏んでから旗を置いた",
    perform(
      finishSteps(1),
      reveal(cellAt(4, 5)),
      flag(cellAt(2, 5)),
      ...stepActions(steps[2] as MinesweeperTutorialStep),
    ),
  ],
  [
    "地雷がそろった1を押してまとめて開いた",
    perform(finishSteps(2), chord(cellAt(4, 4))),
  ],
] as const;

describe("minesweeperTutorial の盤面", () => {
  test("始まりの盤面は、本番と同じく、周りに地雷の無い1マスから続けて開いた形であること", () => {
    const startPuzzle = minesweeperTutorial.start().puzzle;
    const firstCellAround = getMinesweeperNeighborCellIndices(
      board,
      cellAt(1, 3),
    ).filter((cellIndex) => board.mineCellIndices.includes(cellIndex));

    expect(firstCellAround).toEqual([]);
    expect(startPuzzle.revealedCellIndices).toEqual(
      collectMinesweeperRevealCellIndices(board, [cellAt(1, 3)]),
    );
  });

  test("入口で見せる解き終えた盤面は、地雷でないマスがすべて開き、地雷を明かしていること", () => {
    const goal = minesweeperTutorial.goal();
    const visibleCells = getMinesweeperTutorialVisibleCells(goal);

    expect(isMinesweeperCleared(board, goal.puzzle)).toBe(true);
    expect(
      board.mineCellIndices.map((cellIndex) => visibleCells[cellIndex]?.state),
    ).toEqual(board.mineCellIndices.map(() => "mine"));
  });

  test("操作を教える手順で開いた後は、数字1つを見るだけの読みで、推測せずに地雷の総数を使わずに解き切れること", () => {
    const result = solveByDeduction(
      finishSteps(1).boardState.puzzle,
      allRuleIds,
    );

    expect(isMinesweeperCleared(board, result)).toBe(true);
  });

  test("操作を教える最初の手順は、決め手もルールも持たず、ゴールの盤面で開いているマスを開かせること", () => {
    const [first] = steps;

    expect(first?.introducedRuleId).toBeNull();
    expect(first?.reasonCellIndices).toEqual([]);
    expect(first?.operation).toBe("reveal");
    expect(
      first?.cellIndices.every((cellIndex) =>
        safeCellIndices.includes(cellIndex),
      ),
    ).toBe(true);
  });

  test("ルールを伝える手順は、2つの読みをこの順に1つずつ伝えること", () => {
    const result = ruleStepCases.map(([, step]) => step.introducedRuleId);

    expect(result).toEqual(allRuleIds);
  });

  test.each(ruleStepCases)(
    "手順 %i の印のマスは、始めた盤面で、それまでに伝えた読みだけで手順の操作どおりに決まり、伝えたばかりの読みが要ること",
    (_, step, progress) => {
      const { puzzle } = progress.boardState;
      const earned = progress.earnedRuleIds;
      const before = earned.filter((id) => id !== step.introducedRuleId);
      const withEarned = deduceCells(puzzle, earned);
      const withoutIntroduced = deduceCells(puzzle, before);

      const result = step.cellIndices.map(
        (cellIndex) => withEarned.get(cellIndex)?.mine ?? null,
      );
      const decidedWithout = step.cellIndices.filter((cellIndex) =>
        withoutIntroduced.has(cellIndex),
      );

      expect(result).toEqual(
        step.cellIndices.map(() => step.operation === "flag"),
      );
      expect(decidedWithout).toEqual([]);
    },
  );

  test.each(ruleStepCases)(
    "手順 %i の決め手は、印のマスをすべて決める数字と、その読みに使う、手順で地雷と分かったマスであること",
    (_, step, progress) => {
      const { puzzle } = progress.boardState;
      const [numberCellIndex, ...knownMines] = step.reasonCellIndices;
      const minesSoFar = [
        ...puzzle.flaggedCellIndices,
        ...puzzle.steppedMineCellIndices,
      ];

      const result = step.cellIndices.every((cellIndex) =>
        decides(
          puzzle,
          numberCellIndex ?? -1,
          cellIndex,
          step.operation === "flag",
          knownMines,
        ),
      );

      expect(result).toBe(true);
      expect(
        knownMines.every((cellIndex) => minesSoFar.includes(cellIndex)),
      ).toBe(true);
    },
  );

  test.each(stepCases)(
    "手順 %i の印のマスをどの順で手順どおりに打っても、途中で地雷を踏まず、旗は地雷のマスにだけあること",
    (_, step, progress) => {
      const result = listOrders(step.cellIndices).flatMap((order) => {
        const progresses: Progress[] = [];
        let current = progress;
        for (const cellIndex of order) {
          current = perform(current, { type: step.operation, cellIndex });
          progresses.push(current);
        }
        return progresses.map(({ violated, boardState: { puzzle } }) => ({
          violated,
          stepped: puzzle.steppedMineCellIndices,
          wrongFlags: puzzle.flaggedCellIndices.filter(
            (cellIndex) => !board.mineCellIndices.includes(cellIndex),
          ),
        }));
      });

      expect(result).toEqual(
        result.map(() => ({ violated: false, stepped: [], wrongFlags: [] })),
      );
    },
  );

  test.each(ruleStepCases)(
    "手順 %i で覆いから抜くマスは、決めた数字と、手順のマスを含むその周りの閉じたマスであること",
    (_, step, progress) => {
      const [numberCellIndex] = step.reasonCellIndices;
      const closedAround = getMinesweeperNeighborCellIndices(
        board,
        numberCellIndex ?? -1,
      ).filter(
        (cellIndex) =>
          !progress.boardState.puzzle.revealedCellIndices.includes(cellIndex),
      );

      const result = getMinesweeperTutorialStepSpotlitCellIndices(
        step,
        progress.boardState,
      );

      expect(result).toEqual(
        [...new Set([...step.reasonCellIndices, ...closedAround])].sort(
          (left, right) => left - right,
        ),
      );
      expect(
        step.cellIndices.every((cellIndex) => result.includes(cellIndex)),
      ).toBe(true);
    },
  );

  test.each(thoughtlessCases)(
    "手順 %i で、前の手順の操作のまま考えずに手順のマスを押すと、ルールに合わない手になるか、受け付けられないこと",
    (_, step, progress, previousOperation) => {
      const target = step.cellIndices[0] ?? -1;

      const result = perform(progress, {
        type: previousOperation,
        cellIndex: target,
      });

      expect(previousOperation).not.toBe(step.operation);
      expect(result.violated || result === progress).toBe(true);
    },
  );

  test.each(releasedCases)(
    "手順を終えると、伝えた読みだけで残りが解き切れ、どちらの読みも手を離した後にもう一度要ること: %s",
    (_, progress) => {
      const { puzzle } = progress.boardState;
      const deductions = [...deduceCells(puzzle, allRuleIds).values()];
      const solved = solveByDeduction(puzzle, allRuleIds);
      const unsolvedWithOne = allRuleIds.map(
        (ruleId) =>
          !isMinesweeperCleared(board, solveByDeduction(puzzle, [ruleId])),
      );

      expect(progress.stepIndex).toBe(steps.length);
      expect(isMinesweeperCleared(board, solved)).toBe(true);
      expect(new Set(deductions.map(({ ruleId }) => ruleId))).toEqual(
        new Set(allRuleIds),
      );
      expect(unsolvedWithOne).toEqual(allRuleIds.map(() => true));
    },
  );
});

describe("minesweeperTutorial.perform", () => {
  const flagStepProgress = finishSteps(1);
  const revealStepProgress = finishSteps(2);

  test("手を引いている間は、印の無いマスへの操作で盤面を変えないこと", () => {
    const result = perform(startedProgress, reveal(cellAt(5, 5)));

    expect(result).toBe(startedProgress);
  });

  test("開かせる印のマスに旗を置く手は受け付けないこと", () => {
    const result = perform(revealStepProgress, flag(cellAt(5, 3)));

    expect(result).toBe(revealStepProgress);
  });

  test("旗で地雷がそろった数字を押して、印のマスだけをまとめて開くと、次へ進むこと", () => {
    const result = perform(revealStepProgress, chord(cellAt(4, 4)));

    expect(result.stepIndex).toBe(steps.length);
    expect(result.boardState.lastMove?.fittedCellIndices).toEqual([
      cellAt(5, 3),
      cellAt(5, 4),
      cellAt(5, 5),
    ]);
  });

  test("考えずに旗を置かせる印のマスを開くと、本番と同じく地雷を踏んで、ルールに合わない手になること", () => {
    const result = perform(flagStepProgress, reveal(cellAt(2, 5)));

    expect(result.violated).toBe(true);
    expect(result.stepIndex).toBe(1);
    expect(result.boardState.puzzle.steppedMineCellIndices).toEqual([
      cellAt(2, 5),
    ]);
  });

  test("旗を置かせるマスを一度踏んだら、もう1つは踏ませず、旗を置くと地雷と分かったとして次へ進むこと", () => {
    const stepped = perform(flagStepProgress, reveal(cellAt(2, 5)));
    const secondStep = perform(stepped, reveal(cellAt(4, 5)));
    const flagged = perform(stepped, flag(cellAt(4, 5)));

    expect(secondStep).toBe(stepped);
    expect(flagged.stepIndex).toBe(2);
  });

  test("手を離した後は、本番と同じく旗の正誤を判定しないこと", () => {
    const result = perform(releasedProgress, flag(cellAt(1, 5)));

    expect(result.violated).toBe(false);
    expect(result.boardState.puzzle.flaggedCellIndices).toContain(cellAt(1, 5));
  });

  test("手を離した後は、地雷を踏むとルールに合わない手になり、そのまま解き切れること", () => {
    const stepped = perform(releasedProgress, reveal(cellAt(1, 1)));
    const continued = perform(
      stepped,
      reveal(cellAt(1, 5)),
      reveal(cellAt(5, 1)),
    );

    expect(stepped.violated).toBe(true);
    expect(continued.phase).toBe("solved");
  });
});

describe("minesweeperTutorial の一言", () => {
  const options = { entry: "home", violationSettled: true } as const;
  const guidedSteppedProgress = perform(finishSteps(1), reveal(cellAt(2, 5)));
  const releasedSteppedProgress = perform(
    releasedProgress,
    reveal(cellAt(1, 1)),
  );
  const levelBoardSizes = Object.values(
    minesweeperDifficultyBoardRanges,
  ).flatMap(({ sizes }) => sizes);
  const texts = [
    minesweeperTutorial.intro.purpose,
    minesweeperTutorial.intro.goalCaption,
    ...steps.flatMap(({ message }) => [message.headline, message.detail]),
    minesweeperTutorial.freePlay.headline,
    minesweeperTutorial.freePlay.detail,
    ...Object.values(minesweeperTutorial.completion).flatMap((message) => [
      message.headline,
      message.detail,
    ]),
  ].filter((text) => text !== null);

  test("地雷を踏むと、本番ではミスになることを言い、旗を置かせる手順では残りの地雷への手を添えること", () => {
    const guided = getTutorialMessage(
      minesweeperTutorial,
      guidedSteppedProgress,
      options,
    );
    const released = getTutorialMessage(
      minesweeperTutorial,
      releasedSteppedProgress,
      options,
    );

    expect(guided.headline).toContain("ミスになります");
    expect(guided.detail).toContain("旗");
    expect(released.headline).toBe(guided.headline);
    expect(released.detail).toBeNull();
  });

  test("ゲームのホームから開いたときの完成の一言で、本番の盤面が大きいと言うことが、どのレベルにも当てはまること", () => {
    const result = levelBoardSizes.filter(
      (size) => size.rows <= board.rows || size.columns <= board.columns,
    );

    expect(result).toEqual([]);
    expect(minesweeperTutorial.completion.home.detail).toContain(
      "もっと大きな盤面",
    );
  });

  test("一言は、全角45字まで・3行までで、読点と句点を打たないこと", () => {
    const tooLong = texts.filter(
      (text) =>
        text.replaceAll("\n", "").length > 45 || text.split("\n").length > 3,
    );
    const punctuated = texts.filter((text) => /[、。]/.test(text));

    expect(tooLong).toEqual([]);
    expect(punctuated).toEqual([]);
  });
});

describe("findMinesweeperTutorialHint", () => {
  const releasedSituation = getTutorialSituation(
    minesweeperTutorial,
    releasedProgress,
  );
  const wronglyFlaggedProgress = perform(
    releasedProgress,
    flag(cellAt(1, 1)),
    flag(cellAt(5, 2)),
    flag(cellAt(1, 5)),
  );
  const wronglyFlaggedSituation = getTutorialSituation(
    minesweeperTutorial,
    wronglyFlaggedProgress,
  );

  function followHints(progress: Progress): Progress {
    const hint = findMinesweeperTutorialHint(
      getTutorialSituation(minesweeperTutorial, progress),
      progress.boardState,
    );
    if (!hint || progress.phase !== "playing") {
      return progress;
    }
    const action =
      hint.operation === "flag" ? flag(hint.cellIndex) : reveal(hint.cellIndex);
    return followHints(perform(progress, action));
  }

  test("手を離した盤面では、前に決まったマスを使わずに決まるマスを、決めた数字とともに示すこと", () => {
    const result = findMinesweeperTutorialHint(
      releasedSituation,
      releasedProgress.boardState,
    );

    expect(result).toEqual({
      cellIndex: cellAt(1, 1),
      deduction: expect.objectContaining({ mine: true, round: 1 }),
      operation: "flag",
      reasonCellIndices: [expect.any(Number)],
    });
    expect(
      decides(
        releasedProgress.boardState.puzzle,
        result?.reasonCellIndices[0] ?? -1,
        cellAt(1, 1),
        true,
        [],
      ),
    ).toBe(true);
  });

  test("地雷でないと決まるマスに旗を置いていたら、旗を外させること", () => {
    const result = findMinesweeperTutorialHint(
      wronglyFlaggedSituation,
      wronglyFlaggedProgress.boardState,
    );
    const message = result
      ? describeMinesweeperTutorialHint(
          wronglyFlaggedProgress.boardState,
          result,
        )
      : null;

    expect(result?.cellIndex).toBe(cellAt(1, 5));
    expect(result?.operation).toBe("flag");
    expect(message?.detail).toBe("旗を外して開きます");
  });

  test("示されたとおりに打ち続けると、地雷を踏まずに解き切れること", () => {
    const result = followHints(releasedProgress);

    expect(result.phase).toBe("solved");
    expect(result.boardState.puzzle.steppedMineCellIndices).toEqual([]);
  });
});

describe("getMinesweeperTutorialStepCellIndices", () => {
  const halfFlaggedProgress = perform(finishSteps(1), flag(cellAt(2, 5)));
  const cases = [
    ["旗を1つ置いた手順の途中", halfFlaggedProgress, [cellAt(4, 5)]],
    ["手を離した後", releasedProgress, []],
  ] as const;

  test.each(cases)(
    "手順の印のマスのうち、まだ手順どおりにしていないものを返すこと: %s",
    (_, progress, expected) => {
      const result = getMinesweeperTutorialStepCellIndices(
        getTutorialSituation(minesweeperTutorial, progress),
        progress.boardState,
      );

      expect(result).toEqual(expected);
    },
  );
});

describe("getMinesweeperTutorialProgressRatio", () => {
  const solvedProgress = perform(
    releasedProgress,
    reveal(cellAt(1, 5)),
    reveal(cellAt(5, 1)),
  );
  const cases = [
    ["始めた盤面", 0, startedProgress, 0],
    [
      "手を離した盤面",
      steps.length,
      releasedProgress,
      steps.length / (steps.length + 1),
    ],
    ["解き終えた盤面", steps.length, solvedProgress, 1],
  ] as const;

  test.each(cases)(
    "済んだ手順の数で進み、解き終えると満ちること: %s",
    (_, stepIndex, progress, expected) => {
      const result = getMinesweeperTutorialProgressRatio(
        stepIndex,
        progress.boardState,
      );

      expect(result).toBe(expected);
    },
  );
});
