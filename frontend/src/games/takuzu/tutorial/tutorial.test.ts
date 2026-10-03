import type { TakuzuCell, TakuzuGrid } from "@/games/takuzu/puzzle/board";
import {
  findTakuzuGridRuleViolations,
  hasTakuzuRuleViolation,
  type TakuzuRuleViolations,
} from "@/games/takuzu/puzzle/rules";
import {
  _private,
  findTakuzuTutorialHintCellIndex,
  getTakuzuTutorialCellViews,
  getTakuzuTutorialLineViolations,
  type TakuzuTutorialAction,
  type TakuzuTutorialRuleId,
  type TakuzuTutorialStage,
  type TakuzuTutorialStageState,
  takuzuTutorial,
} from "@/games/takuzu/tutorial/tutorial";
import type { TutorialMoveOutcome } from "@/games/tutorial";

const { deduceCell } = _private;

const [
  operationStage,
  runStage,
  sandwichStage,
  countStage,
  duplicateStage,
  guidedStage,
  finalStage,
] = takuzuTutorial.stages as [
  TakuzuTutorialStage,
  TakuzuTutorialStage,
  TakuzuTutorialStage,
  TakuzuTutorialStage,
  TakuzuTutorialStage,
  TakuzuTutorialStage,
  TakuzuTutorialStage,
];

const allRuleIds = [
  "run",
  "count",
  "duplicate",
] as const satisfies readonly TakuzuTutorialRuleId[];

function withoutDuplicate(
  violations: TakuzuRuleViolations,
): TakuzuRuleViolations {
  return { ...violations, duplicateLines: [] };
}

/** 空きマスをすべての組み合わせで埋め、ルールに合う埋め方を返す。 */
function listSolutions(
  givens: TakuzuGrid,
  ruleIds: readonly TakuzuTutorialRuleId[],
): string[] {
  const emptyCellIndices = givens.cells.flatMap((cell, index) =>
    cell === null ? [index] : [],
  );
  return Array.from(
    { length: 2 ** emptyCellIndices.length },
    function fill(_, pattern) {
      const cells = [...givens.cells];
      emptyCellIndices.forEach((cellIndex, bit) => {
        cells[cellIndex] = (pattern >> bit) & 1 ? "b" : "a";
      });
      return { ...givens, cells };
    },
  )
    .filter(function satisfiesRules(grid) {
      const violations = findTakuzuGridRuleViolations(grid);
      return !hasTakuzuRuleViolation(
        ruleIds.includes("duplicate")
          ? violations
          : withoutDuplicate(violations),
      );
    })
    .map((grid) => grid.cells.join(""));
}

/** 知っているルールだけで決まるマスを、決まらなくなるまで埋める。 */
function fillByDeduction(
  givens: TakuzuGrid,
  ruleIds: readonly TakuzuTutorialRuleId[],
): TakuzuCell[] {
  const cells = [...givens.cells];
  for (;;) {
    const grid = { ...givens, cells };
    const deduced = cells
      .map((_, cellIndex) => ({
        cellIndex,
        deduction: deduceCell(grid, ruleIds, cellIndex),
      }))
      .find(({ deduction }) => deduction !== null);
    if (!deduced?.deduction) {
      return cells;
    }
    cells[deduced.cellIndex] = deduced.deduction.tile;
  }
}

function performAll(
  stage: TakuzuTutorialStage,
  actions: readonly TakuzuTutorialAction[],
  initialState: TakuzuTutorialStageState = takuzuTutorial.startStage(stage),
): { state: TakuzuTutorialStageState; outcomes: TutorialMoveOutcome[] } {
  return actions.reduce<{
    state: TakuzuTutorialStageState;
    outcomes: TutorialMoveOutcome[];
  }>(
    function performOne({ state, outcomes }, action) {
      const result = takuzuTutorial.perform(stage, state, action);
      return { state: result.state, outcomes: [...outcomes, result.outcome] };
    },
    { state: initialState, outcomes: [] },
  );
}

function startGuide(
  stage: TakuzuTutorialStage,
  state: TakuzuTutorialStageState,
  guideIndex: number,
): TakuzuTutorialStageState {
  return takuzuTutorial.startGuide(
    stage,
    state,
    stage.guides[guideIndex] ?? null,
  );
}

function tap(cellIndex: number): TakuzuTutorialAction {
  return { type: "cycle", cellIndex, direction: "forward" };
}

function place(cellIndex: number, cell: TakuzuCell): TakuzuTutorialAction {
  return { type: "place", cellIndex, cell };
}

describe("takuzuTutorial.stages", () => {
  const ruleStageCases = takuzuTutorial.stages.flatMap((stage, index) =>
    stage.goal === null ? [[index, stage] as const] : [],
  );

  describe("ステージ0", () => {
    test("ルールを持たず、目標の盤面で解けること", () => {
      const result = {
        ruleIds: operationStage.ruleIds,
        goal: operationStage.goal,
      };

      expect(result.ruleIds).toEqual([]);
      expect(result.goal?.cells).toEqual(["a", "b"]);
    });
  });

  test.each(ruleStageCases)(
    "ステージ %i の盤面は3つのルールでただ1つの解を持つこと",
    (_, stage) => {
      const result = listSolutions(stage.givens, allRuleIds);

      expect(result).toHaveLength(1);
    },
  );

  describe("ステージ4", () => {
    test("3つ続かないことと同じ数だけでは解が1つに決まらないこと", () => {
      const result = listSolutions(duplicateStage.givens, ["run", "count"]);

      expect(result.length).toBeGreaterThan(1);
    });

    test("3つ続かないことと同じ数だけで決まるマスが無いこと", () => {
      const result = fillByDeduction(duplicateStage.givens, ["run", "count"]);

      expect(result).toEqual(duplicateStage.givens.cells);
    });

    test("同じ並びを作れないことを加えると、決まるマスを順に埋めて解き切れること", () => {
      const result = fillByDeduction(duplicateStage.givens, allRuleIds);

      expect(result.join("")).toBe(
        listSolutions(duplicateStage.givens, allRuleIds)[0],
      );
    });
  });

  describe.each([
    [5, guidedStage],
    [6, finalStage],
  ] as const)("ステージ%i", (_, stage) => {
    test("3つ続かないことと同じ数だけでは解が1つに決まらないこと", () => {
      const result = listSolutions(stage.givens, ["run", "count"]);

      expect(result.length).toBeGreaterThan(1);
    });

    test("3つ続かないことと同じ数だけでは、決まるマスを埋める途中で行き詰まること", () => {
      const result = fillByDeduction(stage.givens, ["run", "count"]);

      expect(result).toContain(null);
    });

    test("同じ並びを作れないことを加えると、決まるマスを順に埋めて解き切れること", () => {
      const result = fillByDeduction(stage.givens, allRuleIds);

      expect(result.join("")).toBe(listSolutions(stage.givens, allRuleIds)[0]);
    });
  });
});

describe("takuzuTutorial.perform", () => {
  describe("ステージ0で手を引いている場合", () => {
    const firstGuideState = startGuide(
      operationStage,
      takuzuTutorial.startStage(operationStage),
      0,
    );
    const secondGuideState = startGuide(
      operationStage,
      performAll(operationStage, [tap(0)], firstGuideState).state,
      1,
    );

    test("左のマスから順に、目標と違うマスを示すこと", () => {
      const result = [
        firstGuideState.guidedCellIndex,
        secondGuideState.guidedCellIndex,
      ];

      expect(result).toEqual([0, 1]);
    });

    test("左を四角にすると案内どおりの手になり、右を丸に切り替えると解けること", () => {
      const { outcomes: firstOutcomes } = performAll(
        operationStage,
        [tap(0)],
        firstGuideState,
      );
      const { outcomes: secondOutcomes } = performAll(
        operationStage,
        [tap(1), tap(1)],
        secondGuideState,
      );

      expect(firstOutcomes).toEqual(["guided"]);
      expect(secondOutcomes).toEqual(["continued", "solved"]);
    });

    test("示していないマスへの操作は、盤面を変えないこと", () => {
      const { outcomes } = performAll(
        operationStage,
        [tap(1)],
        firstGuideState,
      );

      expect(outcomes).toEqual(["ignored"]);
    });
  });

  describe("ステージ0で四角を2つ置いた場合", () => {
    const { outcomes } = performAll(operationStage, [
      place(0, "a"),
      place(1, "a"),
    ]);

    test("ルールに合わないとはせず、目標と違うので解けないこと", () => {
      const result = outcomes;

      expect(result).toEqual(["continued", "continued"]);
    });
  });

  describe("ステージ1", () => {
    const { state, outcomes } = performAll(runStage, [tap(2), tap(2)]);

    test("1回目のタップで3つ続いて違反になり、2回目で丸になって解けること", () => {
      const result = outcomes;

      expect(result).toEqual(["violated", "solved"]);
    });

    test("解けた手の決め手として、並んだ2つの四角を返すこと", () => {
      const result = state.lastMove;

      expect(result).toEqual({
        cellIndex: 2,
        violated: false,
        reasonCellIndices: [0, 1],
      });
    });
  });

  describe("ステージ1で1回だけタップした場合", () => {
    const { state } = performAll(runStage, [tap(2)]);

    test("置いたマスがルールに合わないことと、3つ続くマスを示すこと", () => {
      const lastMove = state.lastMove;
      const cellViews = getTakuzuTutorialCellViews(runStage, state);

      expect(lastMove?.violated).toBe(true);
      expect(cellViews.map((view) => view.inViolatingRun)).toEqual([
        true,
        true,
        true,
      ]);
    });
  });

  describe("ステージ2", () => {
    const { state, outcomes } = performAll(sandwichStage, [tap(1)]);

    test("挟まれたマスに四角を置くと、挟む2つを決め手にして解けること", () => {
      const result = { outcomes, reason: state.lastMove?.reasonCellIndices };

      expect(result).toEqual({ outcomes: ["solved"], reason: [0, 2] });
    });
  });

  describe("ステージ3で四角を置いた場合", () => {
    const { state, outcomes } = performAll(countStage, [tap(3)]);

    test("行の個数超過を示すこと", () => {
      const result = getTakuzuTutorialLineViolations(countStage, state);

      expect(outcomes).toEqual(["violated"]);
      expect(result).toEqual([
        { axis: "row", index: 0, overfilled: true, duplicated: false },
      ]);
    });
  });

  describe("ステージ3で丸に切り替えた場合", () => {
    const { state, outcomes } = performAll(countStage, [tap(3), tap(3)]);

    test("同じ数の四角を決め手にして解けること", () => {
      const result = { outcomes, reason: state.lastMove?.reasonCellIndices };

      expect(result).toEqual({
        outcomes: ["violated", "solved"],
        reason: [0, 2],
      });
    });
  });

  describe("ステージ5で手を引いている場合", () => {
    const firstGuideState = startGuide(
      guidedStage,
      takuzuTutorial.startStage(guidedStage),
      0,
    );
    // 1行目 `AA..` の3列目は、四角が2つ並んだ隣なので丸に決まる。
    const secondGuideState = startGuide(
      guidedStage,
      performAll(guidedStage, [place(2, "b")], firstGuideState).state,
      1,
    );

    test("1つ目の案内では、3つ続かないことで決まるマスを示すこと", () => {
      const result = firstGuideState.guidedCellIndex;

      expect(result).toBe(2);
    });

    test("示していないマスへの操作は、決まるマスでも盤面を変えないこと", () => {
      // 1行目は四角が2つそろっていて4列目は丸に、2行目は丸が2つそろっていて4列目は四角に決まる。
      const { state, outcomes } = performAll(
        guidedStage,
        [place(3, "b"), tap(7), place(7, "a")],
        firstGuideState,
      );

      expect(outcomes).toEqual(["ignored", "ignored", "ignored"]);
      expect(state).toBe(firstGuideState);
    });

    test("示したマスに案内どおりのタイルを置くと、案内どおりの手として返すこと", () => {
      const { outcomes } = performAll(
        guidedStage,
        [place(2, "b")],
        firstGuideState,
      );

      expect(outcomes).toEqual(["guided"]);
    });

    test("2つ目の案内では、同じ数で決まるマスを示すこと", () => {
      const result = secondGuideState.guidedCellIndex;

      expect(result).toBe(3);
    });

    test("示したマスは、四角から丸へ切り替えて案内どおりにできること", () => {
      const { outcomes } = performAll(
        guidedStage,
        [tap(3), tap(3)],
        secondGuideState,
      );

      expect(outcomes).toEqual(["violated", "guided"]);
    });

    test.each([
      [1, 2, "a"],
      [2, 3, "a"],
    ] as const)(
      "%i つ目の案内のマスに違う方を置くと、知っているルールに合わなくなること",
      (guideIndex, cellIndex, wrongTile) => {
        const initialState =
          guideIndex === 1 ? firstGuideState : secondGuideState;
        const { outcomes } = performAll(
          guidedStage,
          [place(cellIndex, wrongTile)],
          initialState,
        );

        expect(outcomes).toEqual(["violated"]);
      },
    );

    test("手を離すと、どのマスにも置けること", () => {
      const released = startGuide(
        guidedStage,
        performAll(guidedStage, [place(3, "b")], secondGuideState).state,
        2,
      );

      const { outcomes } = performAll(guidedStage, [place(8, "a")], released);

      expect(released.guidedCellIndex).toBeNull();
      expect(outcomes).toEqual(["continued"]);
    });
  });

  describe("ステージ5で1手目を置いた盤面で決まるマスを探す場合", () => {
    const { state } = performAll(guidedStage, [place(2, "b")]);

    test("3つ続かないことを先に探すと、丸に挟まれたマスを返すこと", () => {
      const result = findTakuzuTutorialHintCellIndex(guidedStage, state, "run");

      expect(result).toBe(9);
    });

    test("同じ数を先に探すと、四角がそろった行のマスを返すこと", () => {
      const result = findTakuzuTutorialHintCellIndex(
        guidedStage,
        state,
        "count",
      );

      expect(result).toBe(3);
    });

    test("先に探すルールで決まるマスが無ければ、ほかのルールで決まるマスを返すこと", () => {
      const result = findTakuzuTutorialHintCellIndex(
        guidedStage,
        state,
        "duplicate",
      );

      expect(result).toBe(9);
    });
  });

  describe("固定マスを押した場合", () => {
    const { state, outcomes } = performAll(runStage, [tap(0)]);

    test("盤面を変えないこと", () => {
      const result = outcomes;

      expect(result).toEqual(["ignored"]);
      expect(state).toEqual(takuzuTutorial.startStage(runStage));
    });
  });

  describe.each([
    [5, guidedStage],
    [6, finalStage],
  ] as const)(
    "ステージ%iで3つ続かないことと同じ数で決まるマスを埋め切った場合",
    (_, stage) => {
      const stuckCells = fillByDeduction(stage.givens, ["run", "count"]);
      const actions = stuckCells.flatMap((cell, cellIndex) =>
        cell !== null && stage.givens.cells[cellIndex] === null
          ? [place(cellIndex, cell)]
          : [],
      );
      const { state } = performAll(stage, actions);

      test("同じ並びを作れないことで決まるマスを示すこと", () => {
        const cellIndex = findTakuzuTutorialHintCellIndex(stage, state);
        const deduced = (ruleIds: readonly TakuzuTutorialRuleId[]) =>
          cellIndex !== null &&
          deduceCell(state.grid, ruleIds, cellIndex) !== null;

        expect(deduced(["duplicate"])).toBe(true);
        expect(deduced(["run", "count"])).toBe(false);
      });
    },
  );

  describe("ステージ6で1行目と3行目を同じ並びにした場合", () => {
    // どちらも BBAA。3つ続かないことと同じ数には合う。
    const { state, outcomes } = performAll(finalStage, [
      place(0, "b"),
      place(1, "b"),
      place(3, "a"),
      place(9, "b"),
      place(10, "a"),
      place(11, "a"),
    ]);

    test("ルールに合わないとして、重なった行を示すこと", () => {
      const result = getTakuzuTutorialLineViolations(finalStage, state);

      expect(outcomes.at(-1)).toBe("violated");
      expect(result).toEqual([
        { axis: "row", index: 0, overfilled: false, duplicated: true },
        { axis: "row", index: 2, overfilled: false, duplicated: true },
      ]);
    });
  });
});

describe("takuzuTutorial.describeViolation", () => {
  const cases = [
    [
      "四角が3つ続いた",
      runStage,
      [tap(2)],
      {
        headline: "四角が3つ続いている",
        detail: "同じものは3つ続けて置けない",
      },
    ],
    [
      "1行だけの盤面で四角が多すぎる",
      countStage,
      [tap(3)],
      { headline: "四角が多すぎる", detail: "行も列も、四角と丸は同じ数" },
    ],
    [
      "すぐ上の行と同じ並びにした",
      duplicateStage,
      [place(10, "b"), place(11, "a")],
      {
        headline: "上の行と同じ並びになっている",
        detail: "同じ並びの行・列は作れない",
      },
    ],
    [
      "離れた行と同じ並びにした",
      duplicateStage,
      [place(14, "a"), place(15, "b")],
      {
        headline: "1行目と同じ並びになっている",
        detail: "同じ並びの行・列は作れない",
      },
    ],
    [
      "4×4の盤面で四角が多すぎる列ができた",
      guidedStage,
      [place(8, "a"), place(12, "a")],
      {
        headline: "四角が多すぎる列がある",
        detail: "行も列も、四角と丸は同じ数",
      },
    ],
  ] as const;

  test.each(cases)(
    "当たったルールを具体的に言うこと: %s",
    (_, stage, actions, expected) => {
      const { state } = performAll(stage, actions);

      const result = takuzuTutorial.describeViolation(stage, state);

      expect(result).toEqual(expected);
    },
  );
});
