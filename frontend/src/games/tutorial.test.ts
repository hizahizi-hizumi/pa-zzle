import {
  advanceTutorialStage,
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
  violation: createMessage("1の違反"),
  solved: createMessage("1の解決"),
  earnedRuleId: "first",
  revealedRule: null,
};

const secondStage: TutorialStage<RuleId> = {
  intro: createMessage("2の導入"),
  violation: createMessage("2の違反"),
  solved: createMessage("2の解決"),
  earnedRuleId: "second",
  revealedRule: { id: "second", message: createMessage("2のルール") },
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
): FakeProgress {
  return actions.reduce(
    (current, action) => performTutorialAction(fakeTutorial, current, action),
    progress,
  );
}

describe("startTutorial", () => {
  test("最初のステージの導入から、ルールを持たずに始めること", () => {
    const result = startTutorial(fakeTutorial);

    expect(result).toEqual({
      stageIndex: 0,
      stageState: 0,
      earnedRuleIds: [],
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

  test("解けたらステージのルールを手に入れ、次へ進むのを待つこと", () => {
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

  describe("途中でルールを明かすステージの場合", () => {
    const secondStageStarted = advanceTutorialStage(
      fakeTutorial,
      performTutorialAction(fakeTutorial, started, "solved"),
    );

    test("明かしたルールを手に入れ、その説明を出すこと", () => {
      const result = performTutorialAction(
        fakeTutorial,
        secondStageStarted,
        "rule-revealed",
      );

      expect(result.earnedRuleIds).toEqual(["first", "second"]);
      expect(result.message).toBe(secondStage.revealedRule?.message);
    });

    test("明かした後にルールに合う手を置くと、導入ではなくルールの説明を出し続けること", () => {
      const result = performAll(secondStageStarted, [
        "rule-revealed",
        "violated",
        "continued",
      ]);

      expect(result.message).toBe(secondStage.revealedRule?.message);
    });

    test("明かしたルールを解けたときに重ねて手に入れないこと", () => {
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

    test("終えること", () => {
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

  test("違反が続いたときに違反の一言を出すこと", () => {
    const result = getTutorialMessage(fakeTutorial, violated, true);

    expect(result).toBe(firstStage.violation);
  });

  test("違反が続くまでは違反の前の一言を出すこと", () => {
    const result = getTutorialMessage(fakeTutorial, violated, false);

    expect(result).toBe(firstStage.intro);
  });
});
