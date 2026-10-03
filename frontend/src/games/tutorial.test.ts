import {
  getCurrentTutorialStep,
  isTutorialCompleted,
  performTutorialAction,
  startTutorial,
  type Tutorial,
  type TutorialProgress,
} from "@/games/tutorial";

type CounterAction = { target: "left" | "right"; amount: number };
type CounterState = { left: number; right: number };

const counterTutorial: Tutorial<
  CounterState,
  CounterAction,
  CounterAction["target"]
> = {
  initialState: { left: 0, right: 0 },
  steps: [
    {
      instruction: "左を増やす",
      highlightedTargets: ["left"],
      allows(_state, action) {
        return action.target === "left";
      },
      isAchieved(state) {
        return state.left >= 2;
      },
    },
    {
      instruction: "右を増やす",
      highlightedTargets: ["right"],
      allows(_state, action) {
        return action.target === "right";
      },
      isAchieved(state) {
        return state.right >= 1;
      },
    },
  ],
  perform(state, action) {
    return { ...state, [action.target]: state[action.target] + action.amount };
  },
};

describe("startTutorial", () => {
  test("初期状態の最初のステップから始めること", () => {
    const progress = startTutorial(counterTutorial);

    expect(progress).toEqual({
      state: { left: 0, right: 0 },
      achievedStepCount: 0,
    });
  });
});

describe("isTutorialCompleted", () => {
  const completed: TutorialProgress<CounterState> = {
    state: { left: 2, right: 1 },
    achievedStepCount: 2,
  };

  test("すべてのステップを達成したら終えたと判定すること", () => {
    const result = isTutorialCompleted(counterTutorial, completed);

    expect(result).toBe(true);
  });
});

describe("getCurrentTutorialStep", () => {
  const completed: TutorialProgress<CounterState> = {
    state: { left: 2, right: 1 },
    achievedStepCount: 2,
  };

  test("終えた後は今のステップが無いこと", () => {
    const step = getCurrentTutorialStep(counterTutorial, completed);

    expect(step).toBeNull();
  });
});

describe("performTutorialAction", () => {
  const started = startTutorial(counterTutorial);

  test("受け付けない操作では同じ進行をそのまま返すこと", () => {
    const progress = performTutorialAction(counterTutorial, started, {
      target: "right",
      amount: 1,
    });

    expect(progress).toBe(started);
  });

  test("達成していない操作では盤面だけを進めること", () => {
    const progress = performTutorialAction(counterTutorial, started, {
      target: "left",
      amount: 1,
    });

    expect(progress).toEqual({
      state: { left: 1, right: 0 },
      achievedStepCount: 0,
    });
  });

  test("達成した操作で次のステップへ進むこと", () => {
    const progress = performTutorialAction(counterTutorial, started, {
      target: "left",
      amount: 2,
    });

    expect(progress.achievedStepCount).toBe(1);
  });

  describe("最後のステップを達成した場合", () => {
    const lastStep: TutorialProgress<CounterState> = {
      state: { left: 2, right: 0 },
      achievedStepCount: 1,
    };
    const completed: TutorialProgress<CounterState> = {
      state: { left: 2, right: 1 },
      achievedStepCount: 2,
    };

    test("チュートリアルを終えること", () => {
      const progress = performTutorialAction(counterTutorial, lastStep, {
        target: "right",
        amount: 1,
      });

      expect(progress).toEqual(completed);
    });

    test("終えた後の操作では同じ進行をそのまま返すこと", () => {
      const progress = performTutorialAction(counterTutorial, completed, {
        target: "right",
        amount: 1,
      });

      expect(progress).toBe(completed);
    });
  });
});
