/**
 * 小さなパズルを順に解きながら、ルールを自分で見つけていくチュートリアルの、ゲームに依存しない契約。
 * ステージの進行、手に入れたルール、盤面の上に出す一言を扱い、盤面と判定はゲームが持つ。
 * - `RuleId`: ゲームのルールの識別子。
 * - `StageState`: 1つのステージを解いている途中の盤面の状態。
 * - `Action`: 利用者の1回の操作。
 */

/** 盤面の上に出す一言。`detail` は見出しを補う短い一文。 */
export type TutorialMessage = {
  headline: string;
  detail: string | null;
};

/** 手に入れると、チュートリアルの上部に並ぶルール。 */
export type TutorialRule<RuleId extends string> = {
  id: RuleId;
  label: string;
};

/**
 * ステージの最初の数手だけ手を引く案内の1手ぶん。決まるマスを最初から示し、手を引いている間はそのマスへの操作だけを受け付ける。
 * 示したマスに案内どおりの手が置かれたら、次の案内へ進む。
 * - `ruleId`: 示すマスを決めるルール。
 * - `message`: 案内している間の一言。
 */
export type TutorialGuide<RuleId extends string> = {
  ruleId: RuleId;
  message: TutorialMessage;
};

/**
 * 1つのステージ。答えは示さず、文言は手の結果に応じて切り替える。
 * - `intro`: ステージを始めたときと、ルールに合う手を置いたとき。案内があるステージでは、案内を終えた後。
 * - `guides`: 最初の数手の案内。順に1つずつ進み、すべて終えたら手を離す。
 * - `violation`: ルールに合わないところができ、そのまましばらく続いたとき。
 * - `solved`: 解けたとき。
 * - `earnedRuleId`: 解けたときに手に入るルール。
 * - `revealedRule`: 解いている途中で明かすルールと、明かしてからの文言。明かした時点で手に入る。
 */
export type TutorialStage<RuleId extends string> = {
  intro: TutorialMessage;
  guides: readonly TutorialGuide<RuleId>[];
  violation: TutorialMessage;
  solved: TutorialMessage;
  earnedRuleId: RuleId | null;
  revealedRule: { id: RuleId; message: TutorialMessage } | null;
};

/**
 * ゲームが判定した1手の結果。
 * - `ignored`: 盤面が変わらなかった。
 * - `continued`: ルールに合うところに置いた。まだ解けていない。
 * - `guided`: 案内しているところに、案内どおりの手を置いた。まだ解けていない。次の案内へ進む。
 * - `violated`: ルールに合わないところができた。
 * - `rule-revealed`: ステージの `revealedRule` を明かす局面になった。
 * - `solved`: 解けた。
 */
export type TutorialMoveOutcome =
  | "ignored"
  | "continued"
  | "guided"
  | "violated"
  | "rule-revealed"
  | "solved";

export type Tutorial<
  RuleId extends string,
  Stage extends TutorialStage<RuleId>,
  StageState,
  Action,
> = {
  /** 上部に並べる順。 */
  rules: readonly TutorialRule<RuleId>[];
  stages: readonly Stage[];
  /** すべてのステージを解き終えたときの一言。 */
  completion: TutorialMessage;
  startStage: (stage: Stage) => StageState;
  /**
   * 案内を始めるときと、すべての案内を終えて手を離すとき（`guide` が `null`）に呼ぶ。
   * 手を引いている間にどの操作を受け付けるかは、ゲームがここで盤面の状態に決めておき、`perform` で守る。
   */
  startGuide: (
    stage: Stage,
    state: StageState,
    guide: TutorialGuide<RuleId> | null,
  ) => StageState;
  perform: (
    stage: Stage,
    state: StageState,
    action: Action,
  ) => { state: StageState; outcome: TutorialMoveOutcome };
};

/**
 * - `playing`: ステージを解いている。
 * - `stage-solved`: ステージを解き、次へ進むのを待っている。解けた盤面の演出を見せる間。
 * - `completed`: すべてのステージを解き終えた。
 */
export type TutorialPhase = "playing" | "stage-solved" | "completed";

/**
 * - `guideIndex`: ステージの案内のうち、今の案内の位置。案内の数と同じなら手を離している。
 * - `message`: ルールに合わないところが無いときの一言。
 * - `violated`: 最後の手でルールに合わないところができている。違反の一言は、違反がしばらく続いたときに出す側が出す。
 */
export type TutorialProgress<RuleId extends string, StageState> = {
  stageIndex: number;
  stageState: StageState;
  earnedRuleIds: readonly RuleId[];
  guideIndex: number;
  message: TutorialMessage;
  violated: boolean;
  phase: TutorialPhase;
};

function startStageProgress<
  RuleId extends string,
  Stage extends TutorialStage<RuleId>,
  StageState,
  Action,
>(
  tutorial: Tutorial<RuleId, Stage, StageState, Action>,
  stageIndex: number,
  earnedRuleIds: readonly RuleId[],
): TutorialProgress<RuleId, StageState> {
  const stage = getTutorialStage(tutorial, stageIndex);
  return {
    stageIndex,
    stageState: tutorial.startGuide(
      stage,
      tutorial.startStage(stage),
      stage.guides[0] ?? null,
    ),
    earnedRuleIds,
    guideIndex: 0,
    message: stage.guides[0]?.message ?? stage.intro,
    violated: false,
    phase: "playing",
  };
}

function getTutorialStage<
  RuleId extends string,
  Stage extends TutorialStage<RuleId>,
  StageState,
  Action,
>(
  tutorial: Tutorial<RuleId, Stage, StageState, Action>,
  stageIndex: number,
): Stage {
  const stage = tutorial.stages[stageIndex];
  if (!stage) {
    throw new RangeError(`Tutorial has no stage ${stageIndex}`);
  }
  return stage;
}

function earnRule<RuleId extends string>(
  earnedRuleIds: readonly RuleId[],
  ruleId: RuleId | null,
): readonly RuleId[] {
  return ruleId === null || earnedRuleIds.includes(ruleId)
    ? earnedRuleIds
    : [...earnedRuleIds, ruleId];
}

/** ルールに合う手を置いたときの一言。途中で明かしたルールがあればその説明を、案内の途中ならその案内を出し続ける。 */
function getGuidingMessage<RuleId extends string>(
  stage: TutorialStage<RuleId>,
  earnedRuleIds: readonly RuleId[],
  guideIndex: number,
): TutorialMessage {
  if (stage.revealedRule && earnedRuleIds.includes(stage.revealedRule.id)) {
    return stage.revealedRule.message;
  }
  return stage.guides[guideIndex]?.message ?? stage.intro;
}

export function startTutorial<
  RuleId extends string,
  Stage extends TutorialStage<RuleId>,
  StageState,
  Action,
>(
  tutorial: Tutorial<RuleId, Stage, StageState, Action>,
): TutorialProgress<RuleId, StageState> {
  return startStageProgress(tutorial, 0, []);
}

/** 取り組んでいる、または最後に解いたステージ。 */
export function getCurrentTutorialStage<
  RuleId extends string,
  Stage extends TutorialStage<RuleId>,
  StageState,
  Action,
>(
  tutorial: Tutorial<RuleId, Stage, StageState, Action>,
  progress: TutorialProgress<RuleId, StageState>,
): Stage {
  return getTutorialStage(tutorial, progress.stageIndex);
}

/**
 * 盤面の上に出す一言。
 * 違反の一言は、切り替えの途中で一瞬だけ違反になった手で文言がちらつかないよう、出す側が違反の続いたこと（`violationSettled`）を確かめてから出す。
 */
export function getTutorialMessage<
  RuleId extends string,
  Stage extends TutorialStage<RuleId>,
  StageState,
  Action,
>(
  tutorial: Tutorial<RuleId, Stage, StageState, Action>,
  progress: TutorialProgress<RuleId, StageState>,
  violationSettled: boolean,
): TutorialMessage {
  return progress.violated && violationSettled
    ? getCurrentTutorialStage(tutorial, progress).violation
    : progress.message;
}

/** 手を引いている間の今の案内。手を離した後と、ステージを解いている間でなければ `null`。 */
export function getCurrentTutorialGuide<
  RuleId extends string,
  Stage extends TutorialStage<RuleId>,
  StageState,
  Action,
>(
  tutorial: Tutorial<RuleId, Stage, StageState, Action>,
  progress: TutorialProgress<RuleId, StageState>,
): TutorialGuide<RuleId> | null {
  if (progress.phase !== "playing") {
    return null;
  }
  const stage = getCurrentTutorialStage(tutorial, progress);
  return stage.guides[progress.guideIndex] ?? null;
}

/** ステージを解いている間だけ操作を受け付ける。それ以外では同じ進行をそのまま返す。 */
export function performTutorialAction<
  RuleId extends string,
  Stage extends TutorialStage<RuleId>,
  StageState,
  Action,
>(
  tutorial: Tutorial<RuleId, Stage, StageState, Action>,
  progress: TutorialProgress<RuleId, StageState>,
  action: Action,
): TutorialProgress<RuleId, StageState> {
  if (progress.phase !== "playing") {
    return progress;
  }

  const stage = getCurrentTutorialStage(tutorial, progress);
  const { state, outcome } = tutorial.perform(
    stage,
    progress.stageState,
    action,
  );
  const moved = { ...progress, stageState: state, violated: false };
  switch (outcome) {
    case "ignored":
      return progress;
    case "continued":
      return {
        ...moved,
        message: getGuidingMessage(
          stage,
          progress.earnedRuleIds,
          progress.guideIndex,
        ),
      };
    case "guided": {
      const guideIndex = Math.min(progress.guideIndex + 1, stage.guides.length);
      return {
        ...moved,
        stageState: tutorial.startGuide(
          stage,
          state,
          stage.guides[guideIndex] ?? null,
        ),
        guideIndex,
        message: getGuidingMessage(stage, progress.earnedRuleIds, guideIndex),
      };
    }
    case "violated":
      return { ...moved, violated: true };
    case "rule-revealed": {
      const earnedRuleIds = earnRule(
        progress.earnedRuleIds,
        stage.revealedRule?.id ?? null,
      );
      return {
        ...moved,
        earnedRuleIds,
        message: getGuidingMessage(stage, earnedRuleIds, progress.guideIndex),
      };
    }
    case "solved":
      return {
        ...moved,
        earnedRuleIds: earnRule(progress.earnedRuleIds, stage.earnedRuleId),
        message: stage.solved,
        phase: "stage-solved",
      };
  }
}

/** 解いたステージから次のステージへ進む。最後のステージなら終える。 */
export function advanceTutorialStage<
  RuleId extends string,
  Stage extends TutorialStage<RuleId>,
  StageState,
  Action,
>(
  tutorial: Tutorial<RuleId, Stage, StageState, Action>,
  progress: TutorialProgress<RuleId, StageState>,
): TutorialProgress<RuleId, StageState> {
  if (progress.phase !== "stage-solved") {
    return progress;
  }

  const nextStageIndex = progress.stageIndex + 1;
  if (nextStageIndex >= tutorial.stages.length) {
    return { ...progress, message: tutorial.completion, phase: "completed" };
  }
  return startStageProgress(tutorial, nextStageIndex, progress.earnedRuleIds);
}
