import { countTakuzuSolutions } from "@/games/takuzu/problem/generation/solver";
import {
  findTakuzuRuleViolations,
  hasTakuzuRuleViolation,
} from "@/games/takuzu/puzzle/rules";
import type { TakuzuSession } from "@/games/takuzu/session/session";
import {
  type TakuzuTutorialAction,
  takuzuTutorial,
} from "@/games/takuzu/tutorial/tutorial";
import {
  getCurrentTutorialStep,
  isTutorialCompleted,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";

function tap(cellIndex: number): TakuzuTutorialAction {
  return { type: "cycle", cellIndex, direction: "forward" };
}

/** 指示どおりに進める操作をステップごとに並べる。5 は一度同じ並びを作ってから直す。 */
const actionsByStep: readonly (readonly TakuzuTutorialAction[])[] = [
  [tap(2)],
  [tap(2)],
  [tap(10), tap(10)],
  [tap(11), tap(11)],
  [tap(1), tap(3), tap(3), tap(1), tap(3), tap(3)],
  [tap(6)],
  [
    { type: "place", cellIndex: 4, cell: "b" },
    { type: "place", cellIndex: 5, cell: "a" },
    { type: "place", cellIndex: 7, cell: "b" },
    { type: "place", cellIndex: 12, cell: "b" },
    { type: "place", cellIndex: 14, cell: "a" },
    { type: "place", cellIndex: 15, cell: "a" },
  ],
];

function performAll(
  progress: TutorialProgress<TakuzuSession>,
  actions: readonly TakuzuTutorialAction[],
): TutorialProgress<TakuzuSession> {
  return actions.reduce(function performOne(current, action) {
    return performTutorialAction(takuzuTutorial, current, action);
  }, progress);
}

/** 各ステップを始める時点の進行。最後の要素は終えた後の進行。 */
function listProgressAtEachStep(): TutorialProgress<TakuzuSession>[] {
  const history = [startTutorial(takuzuTutorial)];
  for (const actions of actionsByStep) {
    const current = history.at(-1) ?? startTutorial(takuzuTutorial);
    history.push(performAll(current, actions));
  }
  return history;
}

const progressAtEachStep = listProgressAtEachStep();

describe("takuzuTutorial", () => {
  const { problem } = takuzuTutorial.initialState;

  test("固定タイルだけで解がただ1つに決まり、その解が問題の解であること", () => {
    const result = countTakuzuSolutions(problem.givens);

    expect(result).toEqual({
      solutionCount: 1,
      firstSolution: problem.solution,
    });
  });

  test("ステップの数が指示どおりの操作の並びと同じであること", () => {
    const stepCount = takuzuTutorial.steps.length;

    expect(stepCount).toBe(actionsByStep.length);
  });

  const stepStartCases = takuzuTutorial.steps.map(
    function toCase(step, stepIndex) {
      return [stepIndex + 1, step.instruction, stepIndex] as const;
    },
  );

  describe.each(stepStartCases)(
    "ステップ %i（%s）の場合",
    (_stepNumber, _instruction, stepIndex) => {
      const start = progressAtEachStep[
        stepIndex
      ] as TutorialProgress<TakuzuSession>;

      test("前のステップまでを指示どおりに進めると、このステップから始まること", () => {
        const step = getCurrentTutorialStep(takuzuTutorial, start);

        expect(step).toBe(takuzuTutorial.steps[stepIndex]);
      });

      test("始める時点の盤面にルール違反が無いこと", () => {
        const violated = hasTakuzuRuleViolation(
          findTakuzuRuleViolations(start.state.board),
        );

        expect(violated).toBe(false);
      });

      test("指示どおりの操作で次のステップへ進むこと", () => {
        const progress = performAll(start, actionsByStep[stepIndex] ?? []);

        expect(progress.achievedStepCount).toBe(stepIndex + 1);
      });
    },
  );

  const guidedStepCases = stepStartCases.filter(
    ([, , stepIndex]) =>
      (takuzuTutorial.steps[stepIndex]?.highlightedTargets.length ?? 0) > 0,
  );

  describe.each(guidedStepCases)(
    "強調したマスがあるステップ %i（%s）の場合",
    (_stepNumber, _instruction, stepIndex) => {
      const start = progressAtEachStep[
        stepIndex
      ] as TutorialProgress<TakuzuSession>;
      const highlighted =
        takuzuTutorial.steps[stepIndex]?.highlightedTargets ?? [];
      const otherCellActions = Array.from({ length: 16 }, (_, cellIndex) =>
        tap(cellIndex),
      ).filter((action) => !highlighted.includes(action.cellIndex));

      test("強調していないマスの操作では進行が変わらないこと", () => {
        const progresses = otherCellActions.map((action) =>
          performTutorialAction(takuzuTutorial, start, action),
        );

        expect(progresses.every((progress) => progress === start)).toBe(true);
      });
    },
  );

  describe("すべてのステップを指示どおりに進めた場合", () => {
    const finished = progressAtEachStep.at(
      -1,
    ) as TutorialProgress<TakuzuSession>;

    test("チュートリアルを終えること", () => {
      const completed = isTutorialCompleted(takuzuTutorial, finished);

      expect(completed).toBe(true);
    });

    test("盤面が問題の解と一致すること", () => {
      const board = finished.state.board;

      expect(board).toEqual(problem.solution);
    });
  });

  describe("同じ並びの行を作るステップの途中", () => {
    const start = progressAtEachStep[4] as TutorialProgress<TakuzuSession>;
    const duplicated = performAll(start, [tap(1), tap(3), tap(3)]);

    test("1行目と3行目を同じ並びの違反として示すこと", () => {
      const { duplicateLines } = findTakuzuRuleViolations(
        duplicated.state.board,
      );

      expect(duplicateLines).toEqual([
        { axis: "row", index: 0 },
        { axis: "row", index: 2 },
      ]);
    });

    test("同じ並びのままではステップを達成しないこと", () => {
      const achievedStepCount = duplicated.achievedStepCount;

      expect(achievedStepCount).toBe(4);
    });
  });
});
