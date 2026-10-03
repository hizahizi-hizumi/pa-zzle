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

const [runStage, sandwichStage, countStage, twoRuleStage, finalStage] =
  takuzuTutorial.stages as [
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
  const stageCases = takuzuTutorial.stages.map(
    (stage, index) => [index + 1, stage] as const,
  );

  test.each(stageCases)(
    "ステージ %i の盤面は3つのルールでただ1つの解を持つこと",
    (_, stage) => {
      const result = listSolutions(stage.givens, allRuleIds);

      expect(result).toHaveLength(1);
    },
  );

  describe("ステージ4", () => {
    test("3つ続かないことと同じ数だけで、決まるマスを順に埋めて解き切れること", () => {
      const result = fillByDeduction(twoRuleStage.givens, ["run", "count"]);

      expect(result.join("")).toBe(
        listSolutions(twoRuleStage.givens, allRuleIds)[0],
      );
    });
  });

  describe("ステージ5", () => {
    test("3つ続かないことと同じ数だけでは解が1つに決まらないこと", () => {
      const result = listSolutions(finalStage.givens, ["run", "count"]);

      expect(result.length).toBeGreaterThan(1);
    });

    test("3つ続かないことと同じ数だけでは、決まるマスを埋める途中で行き詰まること", () => {
      const result = fillByDeduction(finalStage.givens, ["run", "count"]);

      expect(result).toContain(null);
    });

    test("同じ並びを作れないことを加えると、決まるマスを順に埋めて解き切れること", () => {
      const result = fillByDeduction(finalStage.givens, allRuleIds);

      expect(result.join("")).toBe(
        listSolutions(finalStage.givens, allRuleIds)[0],
      );
    });
  });
});

describe("takuzuTutorial.perform", () => {
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
      const result = getTakuzuTutorialLineViolations(state);

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

  describe("ステージ4で手を引いている場合", () => {
    const firstGuideState = startGuide(
      twoRuleStage,
      takuzuTutorial.startStage(twoRuleStage),
      0,
    );
    // 4行目 `.B.B` の3列目は、丸に挟まれて四角に決まる。
    const secondGuideState = startGuide(
      twoRuleStage,
      performAll(twoRuleStage, [place(14, "a")], firstGuideState).state,
      1,
    );

    test("1つ目の案内では、3つ続かないことで決まるマスを示すこと", () => {
      const result = firstGuideState.guidedCellIndex;

      expect(result).toBe(14);
    });

    test("示していないマスへの操作は、決まるマスでも盤面を変えないこと", () => {
      // 4列目は丸が2つそろっていて、2行目は四角に決まる。
      const { state, outcomes } = performAll(
        twoRuleStage,
        [place(0, "a"), tap(7), place(7, "a")],
        firstGuideState,
      );

      expect(outcomes).toEqual(["ignored", "ignored", "ignored"]);
      expect(state).toBe(firstGuideState);
    });

    test("示したマスに案内どおりのタイルを置くと、案内どおりの手として返すこと", () => {
      const { outcomes } = performAll(
        twoRuleStage,
        [place(14, "a")],
        firstGuideState,
      );

      expect(outcomes).toEqual(["guided"]);
    });

    test("2つ目の案内では、同じ数で決まるマスを示すこと", () => {
      const result = secondGuideState.guidedCellIndex;

      expect(result).toBe(2);
    });

    test("示したマスは、四角から丸へ切り替えて案内どおりにできること", () => {
      const { outcomes } = performAll(
        twoRuleStage,
        [tap(2), tap(2)],
        secondGuideState,
      );

      expect(outcomes).toEqual(["violated", "guided"]);
    });

    test.each([
      [1, 14, "b"],
      [2, 2, "a"],
    ] as const)(
      "%i つ目の案内のマスに違う方を置くと、知っているルールに合わなくなること",
      (guideIndex, cellIndex, wrongTile) => {
        const initialState =
          guideIndex === 1 ? firstGuideState : secondGuideState;
        const { outcomes } = performAll(
          twoRuleStage,
          [place(cellIndex, wrongTile)],
          initialState,
        );

        expect(outcomes).toEqual(["violated"]);
      },
    );

    test("手を離すと、どのマスにも置けること", () => {
      const released = startGuide(
        twoRuleStage,
        performAll(twoRuleStage, [place(2, "b")], secondGuideState).state,
        2,
      );

      const { outcomes } = performAll(twoRuleStage, [place(0, "a")], released);

      expect(released.guidedCellIndex).toBeNull();
      expect(outcomes).toEqual(["continued"]);
    });
  });

  describe("ステージ4を始めた盤面で決まるマスを探す場合", () => {
    const state = takuzuTutorial.startStage(twoRuleStage);

    test("3つ続かないことを先に探すと、挟まれたマスを返すこと", () => {
      const result = findTakuzuTutorialHintCellIndex(state, "run");

      expect(result).toBe(14);
    });

    test("同じ数を先に探すと、四角か丸がそろった列のマスを返すこと", () => {
      const result = findTakuzuTutorialHintCellIndex(state, "count");

      expect(result).toBe(7);
    });

    test("知らないルールを先に探そうとしても、知っているルールで決まるマスを返すこと", () => {
      const result = findTakuzuTutorialHintCellIndex(state, "duplicate");

      expect(result).toBe(14);
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

  describe("ステージ5で決まるマスだけを埋めて行き詰まった場合", () => {
    const stuckCells = fillByDeduction(finalStage.givens, ["run", "count"]);
    const actions = stuckCells.flatMap((cell, cellIndex) =>
      cell !== null && finalStage.givens.cells[cellIndex] === null
        ? [place(cellIndex, cell)]
        : [],
    );
    const { state, outcomes } = performAll(finalStage, actions);

    test("行き詰まった手で同じ並びのルールを明かすこと", () => {
      const result = outcomes;

      expect(result.at(-1)).toBe("rule-revealed");
      expect(result.slice(0, -1)).not.toContain("rule-revealed");
      expect(state.ruleIds).toContain("duplicate");
    });

    test("明かした後は、同じ並びのルールで決まるマスを示せること", () => {
      const result = findTakuzuTutorialHintCellIndex(state);

      expect(result).not.toBeNull();
    });
  });

  describe("ステージ5で1行目と3行目を同じ並びにした場合", () => {
    // どちらも BBAA。3つ続かないことと同じ数には合う。
    const { state, outcomes } = performAll(finalStage, [
      place(0, "b"),
      place(1, "b"),
      place(3, "a"),
      place(9, "b"),
      place(10, "a"),
      place(11, "a"),
    ]);

    test("同じ並びのルールを明かし、重なった行を示すこと", () => {
      const result = getTakuzuTutorialLineViolations(state);

      expect(outcomes.at(-1)).toBe("rule-revealed");
      expect(result).toEqual([
        { axis: "row", index: 0, overfilled: false, duplicated: true },
        { axis: "row", index: 2, overfilled: false, duplicated: true },
      ]);
    });
  });
});
