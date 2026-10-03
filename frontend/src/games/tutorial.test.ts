import {
  completeTutorial,
  getCurrentTutorialStep,
  getTutorialMessage,
  performTutorialAction,
  startTutorial,
  type Tutorial,
  type TutorialMoveOutcome,
  type TutorialProgress,
  type TutorialStep,
} from "@/games/tutorial";

type RuleId = "first" | "second";

/** 手の結果をそのまま指定できる、盤面を持たないチュートリアル。状態は盤面を変えた手の数。 */
type FakeAction = TutorialMoveOutcome;

function createMessage(headline: string) {
  return { headline, detail: null };
}

const operationStep: TutorialStep<RuleId> = {
  message: createMessage("操作"),
  introducedRuleId: null,
};

const firstRuleStep: TutorialStep<RuleId> = {
  message: createMessage("1つ目のルール"),
  introducedRuleId: "first",
};

const secondRuleStep: TutorialStep<RuleId> = {
  message: createMessage("2つ目のルール"),
  introducedRuleId: "second",
};

const fakeTutorial: Tutorial<
  RuleId,
  TutorialStep<RuleId>,
  number,
  FakeAction
> = {
  rules: [
    { id: "first", label: "1つ目" },
    { id: "second", label: "2つ目" },
  ],
  steps: [operationStep, firstRuleStep, secondRuleStep],
  freePlay: createMessage("残り"),
  completion: createMessage("完了"),
  start() {
    return 0;
  },
  perform(_situation, state, action) {
    return {
      state: action === "ignored" ? state : state + 1,
      outcome: action,
    };
  },
  describeViolation({ earnedRuleIds }, state) {
    return createMessage(`${state}手目の違反（${earnedRuleIds.join("・")}）`);
  },
};

type FakeProgress = TutorialProgress<RuleId, number>;

function performAll(
  progress: FakeProgress,
  actions: readonly FakeAction[],
): FakeProgress {
  return actions.reduce(
    (current, action) => performTutorialAction(fakeTutorial, current, action),
    progress,
  );
}

describe("startTutorial", () => {
  test("最初の手順から、ルールを手に入れずに始めること", () => {
    const result = startTutorial(fakeTutorial);

    expect(result).toEqual({
      boardState: 0,
      stepIndex: 0,
      earnedRuleIds: [],
      violated: false,
      phase: "playing",
    });
  });
});

describe("performTutorialAction", () => {
  const started = startTutorial(fakeTutorial);
  const released = performAll(started, ["stepped", "stepped", "stepped"]);
  const solved = performAll(released, ["solved"]);

  test("盤面が変わらない手では同じ進行を返すこと", () => {
    const result = performTutorialAction(fakeTutorial, started, "ignored");

    expect(result).toBe(started);
  });

  test("手順どおりでない手や違反では、手順を進めないこと", () => {
    const result = performAll(started, ["continued", "violated", "continued"]);

    expect(result.stepIndex).toBe(0);
    expect(result.boardState).toBe(3);
  });

  test("ルールに合わない手で違反を残し、次の手で解くこと", () => {
    const violated = performAll(started, ["violated"]);
    const recovered = performAll(violated, ["continued"]);

    expect(violated.violated).toBe(true);
    expect(recovered.violated).toBe(false);
  });

  test("手順どおりの手で次の手順へ進み、その手順で示すルールを手に入れること", () => {
    const result = performAll(started, ["stepped", "stepped"]);

    expect(getCurrentTutorialStep(fakeTutorial, result)).toBe(secondRuleStep);
    expect(result.earnedRuleIds).toEqual(["first", "second"]);
  });

  test("すべての手順を終えると手を離すこと", () => {
    const result = getCurrentTutorialStep(fakeTutorial, released);

    expect(result).toBeNull();
    expect(released.stepIndex).toBe(fakeTutorial.steps.length);
  });

  test("解けたら、解けた盤面の演出を待つこと", () => {
    const result = solved.phase;

    expect(result).toBe("solved");
  });

  test("解けた後は手を受け付けないこと", () => {
    const result = performTutorialAction(fakeTutorial, solved, "violated");

    expect(result).toBe(solved);
  });
});

describe("completeTutorial", () => {
  const started = startTutorial(fakeTutorial);
  const solved = performAll(started, ["solved"]);

  test("解けた後に、終えたときの操作を待つこと", () => {
    const result = completeTutorial(solved);

    expect(result.phase).toBe("completed");
  });

  test("解いている途中では終えないこと", () => {
    const result = completeTutorial(started);

    expect(result).toBe(started);
  });
});

describe("getTutorialMessage", () => {
  const started = startTutorial(fakeTutorial);
  const violated = performAll(started, ["stepped", "violated"]);
  const released = performAll(started, ["stepped", "stepped", "stepped"]);
  const solved = performAll(released, ["solved"]);

  test("今の手順の一言を出すこと", () => {
    const result = getTutorialMessage(fakeTutorial, started, false);

    expect(result).toBe(operationStep.message);
  });

  test("違反が続いたときに、今の盤面と手に入れたルールから決めた違反の一言を出すこと", () => {
    const result = getTutorialMessage(fakeTutorial, violated, true);

    expect(result).toEqual(createMessage("2手目の違反（first）"));
  });

  test("違反が続くまでは、今の手順の一言を出すこと", () => {
    const result = getTutorialMessage(fakeTutorial, violated, false);

    expect(result).toBe(firstRuleStep.message);
  });

  test("手を離した後は、残りを解く間の一言を出すこと", () => {
    const result = getTutorialMessage(fakeTutorial, released, false);

    expect(result).toBe(fakeTutorial.freePlay);
  });

  test("解けたら、解き終えたときの一言を出すこと", () => {
    const result = getTutorialMessage(fakeTutorial, solved, false);

    expect(result).toBe(fakeTutorial.completion);
  });
});
