import {
  advanceTutorialStage,
  getCurrentTutorialGuide,
  getCurrentTutorialStage,
  getTutorialMessage,
  performTutorialAction,
  startTutorial,
  type Tutorial,
  type TutorialMoveOutcome,
  type TutorialProgress,
  type TutorialStage,
} from "@/games/tutorial";

type RuleId = "first" | "second";

/** 手の結果をそのまま指定できる、盤面を持たないチュートリアル。状態は盤面を変えた手の数。 */
type FakeAction = TutorialMoveOutcome;

function createMessage(headline: string) {
  return { headline, detail: null };
}

const firstStage: TutorialStage<RuleId> = {
  intro: createMessage("1の導入"),
  solved: createMessage("1の解決"),
  introducedRuleId: "first",
  revealedRule: null,
  guides: [],
};

const secondStage: TutorialStage<RuleId> = {
  intro: createMessage("2の導入"),
  solved: createMessage("2の解決"),
  introducedRuleId: null,
  revealedRule: { id: "second", message: createMessage("2のルール") },
  guides: [],
};

const guidedStage: TutorialStage<RuleId> = {
  intro: createMessage("案内の後"),
  solved: createMessage("案内の解決"),
  introducedRuleId: null,
  revealedRule: null,
  guides: [
    { ruleId: "first", message: createMessage("1つ目の案内") },
    { ruleId: "second", message: createMessage("2つ目の案内") },
  ],
};

const fakeTutorial: Tutorial<
  RuleId,
  TutorialStage<RuleId>,
  number,
  FakeAction
> = {
  rules: [
    { id: "first", label: "1つ目" },
    { id: "second", label: "2つ目" },
  ],
  stages: [firstStage, secondStage],
  completion: createMessage("完了"),
  startStage() {
    return 0;
  },
  describeViolation(_stage, state) {
    return createMessage(`${state}手目の違反`);
  },
  startGuide(_stage, state) {
    return state;
  },
  perform(_stage, state, action) {
    return {
      state: action === "ignored" ? state : state + 1,
      outcome: action,
    };
  },
};

type FakeProgress = TutorialProgress<RuleId, number>;

function performAll(
  progress: FakeProgress,
  actions: readonly FakeAction[],
  tutorial: typeof fakeTutorial = fakeTutorial,
): FakeProgress {
  return actions.reduce(
    (current, action) => performTutorialAction(tutorial, current, action),
    progress,
  );
}

describe("startTutorial", () => {
  test("最初のステージの導入から、そのステージで示すルールを手に入れて始めること", () => {
    const result = startTutorial(fakeTutorial);

    expect(result).toEqual({
      stageIndex: 0,
      stageState: 0,
      earnedRuleIds: ["first"],
      guideIndex: 0,
      message: firstStage.intro,
      violated: false,
      phase: "playing",
    });
  });
});

describe("performTutorialAction", () => {
  const started = startTutorial(fakeTutorial);

  test("盤面が変わらない手では同じ進行を返すこと", () => {
    const result = performTutorialAction(fakeTutorial, started, "ignored");

    expect(result).toBe(started);
  });

  test("ルールに合わない手で違反を残し、違反の前の一言を保つこと", () => {
    const result = performTutorialAction(fakeTutorial, started, "violated");

    expect(result.violated).toBe(true);
    expect(result.message).toBe(firstStage.intro);
    expect(result.stageState).toBe(1);
  });

  test("違反の後にルールに合う手を置くと違反を解くこと", () => {
    const result = performAll(started, ["violated", "continued"]);

    expect(result.violated).toBe(false);
  });

  test("解けたら解けたときの一言を出し、次へ進むのを待つこと", () => {
    const result = performTutorialAction(fakeTutorial, started, "solved");

    expect(result).toMatchObject({
      earnedRuleIds: ["first"],
      message: firstStage.solved,
      phase: "stage-solved",
    });
  });

  describe("解けた後の場合", () => {
    const solved = performTutorialAction(fakeTutorial, started, "solved");

    test("手を受け付けないこと", () => {
      const result = performTutorialAction(fakeTutorial, solved, "violated");

      expect(result).toBe(solved);
    });
  });

  describe("途中でルールを示すステージの場合", () => {
    const secondStageStarted = advanceTutorialStage(
      fakeTutorial,
      performTutorialAction(fakeTutorial, started, "solved"),
    );

    test("示したルールを手に入れ、その説明を出すこと", () => {
      const result = performTutorialAction(
        fakeTutorial,
        secondStageStarted,
        "rule-revealed",
      );

      expect(result.earnedRuleIds).toEqual(["first", "second"]);
      expect(result.message).toBe(secondStage.revealedRule?.message);
    });

    test("示した後にルールに合う手を置くと、導入ではなくルールの説明を出し続けること", () => {
      const result = performAll(secondStageStarted, [
        "rule-revealed",
        "violated",
        "continued",
      ]);

      expect(result.message).toBe(secondStage.revealedRule?.message);
    });

    test("示したルールを解けたときに重ねて手に入れないこと", () => {
      const result = performAll(secondStageStarted, [
        "rule-revealed",
        "solved",
      ]);

      expect(result.earnedRuleIds).toEqual(["first", "second"]);
    });
  });
});

describe("advanceTutorialStage", () => {
  const started = startTutorial(fakeTutorial);
  const firstSolved = performTutorialAction(fakeTutorial, started, "solved");

  test("解いたステージの次のステージを、手に入れたルールを保ったまま始めること", () => {
    const result = advanceTutorialStage(fakeTutorial, firstSolved);
    const stage = getCurrentTutorialStage(fakeTutorial, result);

    expect(stage).toBe(secondStage);
    expect(result).toEqual({
      stageIndex: 1,
      stageState: 0,
      earnedRuleIds: ["first"],
      guideIndex: 0,
      message: secondStage.intro,
      violated: false,
      phase: "playing",
    });
  });

  test("解いている途中では進めないこと", () => {
    const result = advanceTutorialStage(fakeTutorial, started);

    expect(result).toBe(started);
  });

  describe("最後のステージを解いた場合", () => {
    const secondSolved = performTutorialAction(
      fakeTutorial,
      advanceTutorialStage(fakeTutorial, firstSolved),
      "solved",
    );

    test("途中で示すルールを示さずに解いても手に入れて、終えること", () => {
      const result = advanceTutorialStage(fakeTutorial, secondSolved);

      expect(result).toMatchObject({
        stageIndex: 1,
        earnedRuleIds: ["first", "second"],
        message: fakeTutorial.completion,
        phase: "completed",
      });
    });
  });
});

describe("getTutorialMessage", () => {
  const violated = performTutorialAction(
    fakeTutorial,
    startTutorial(fakeTutorial),
    "violated",
  );

  test("違反が続いたときに、今の盤面から決めた違反の一言を出すこと", () => {
    const result = getTutorialMessage(fakeTutorial, violated, true);

    expect(result).toEqual(createMessage("1手目の違反"));
  });

  test("違反が続くまでは違反の前の一言を出すこと", () => {
    const result = getTutorialMessage(fakeTutorial, violated, false);

    expect(result).toBe(firstStage.intro);
  });
});

describe("案内のあるステージ", () => {
  const guidedTutorial = { ...fakeTutorial, stages: [guidedStage] };
  const started = startTutorial(guidedTutorial);

  test("1つ目の案内の一言から始めること", () => {
    const result = getCurrentTutorialGuide(guidedTutorial, started);

    expect(result).toBe(guidedStage.guides[0]);
    expect(started.message).toBe(guidedStage.guides[0]?.message);
  });

  test("案内どおりの手を置くと次の案内へ進むこと", () => {
    const result = performTutorialAction(guidedTutorial, started, "guided");

    expect(getCurrentTutorialGuide(guidedTutorial, result)).toBe(
      guidedStage.guides[1],
    );
    expect(result.message).toBe(guidedStage.guides[1]?.message);
  });

  test("案内どおりでない手や違反では案内を進めないこと", () => {
    const result = performAll(
      started,
      ["continued", "violated", "continued"],
      guidedTutorial,
    );

    expect(result.guideIndex).toBe(0);
    expect(result.message).toBe(guidedStage.guides[0]?.message);
  });

  test("すべての案内を終えると手を離し、導入の一言を出すこと", () => {
    const result = performAll(
      started,
      ["guided", "guided", "guided"],
      guidedTutorial,
    );

    expect(getCurrentTutorialGuide(guidedTutorial, result)).toBeNull();
    expect(result.guideIndex).toBe(2);
    expect(result.message).toBe(guidedStage.intro);
  });

  test("案内を始めるたびと手を離すときに、ゲームへ今の案内を渡すこと", () => {
    const startGuide = vi.fn<typeof fakeTutorial.startGuide>(
      (_stage, state) => state,
    );
    const tutorial = { ...guidedTutorial, startGuide };

    performAll(startTutorial(tutorial), ["guided", "guided"], tutorial);

    expect(startGuide.mock.calls.map(([, , guide]) => guide)).toEqual([
      guidedStage.guides[0],
      guidedStage.guides[1],
      null,
    ]);
  });
});
