/**
 * 1つの盤面を、ルールを1つずつ示しながら一緒に埋めていくチュートリアルの、ゲームに依存しない契約。
 * 最初は手順ごとに一言と操作するところを示して手を引き、手順を終えたら手を離して残りを解かせる。
 * 手順の進行、手に入れたルール、盤面の上に出す一言を扱い、盤面と判定はゲームが持つ。
 * - `RuleId`: ゲームのルールの識別子。
 * - `BoardState`: 盤面を解いている途中の状態。
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
 * 手を引く1手順。ゲームは、手順で操作させるところと、そこを終えたとみなす盤面を、この型を広げて持つ。
 * - `message`: この手順の間の一言。
 * - `introducedRuleId`: この手順で示すルール。手順を始めた時点で手に入り、上部のチップでも今示しているルールとして目立たせる。
 */
export type TutorialStep<RuleId extends string> = {
  message: TutorialMessage;
  introducedRuleId: RuleId | null;
};

/**
 * ゲームが手を判定するときの、今の手順と手に入れたルール。
 * - `step`: 手を引いている手順。手順を終えて手を離した後は `null`。
 * - `earnedRuleIds`: 手に入れたルール。まだ示していないルールの違反は見せない。
 */
export type TutorialSituation<
  RuleId extends string,
  Step extends TutorialStep<RuleId>,
> = {
  step: Step | null;
  earnedRuleIds: readonly RuleId[];
};

/**
 * ゲームが判定した1手の結果。
 * - `ignored`: 盤面が変わらなかった。手を引いている間に、手順で操作させていないところを押した場合も含む。
 * - `continued`: 盤面が変わった。ルールに合わないところは無く、手順もまだ終えていない。
 * - `stepped`: 手順で操作させたところを、手順どおりにした。次の手順へ進む。
 * - `violated`: 手に入れたルールに合わないところができた。
 * - `solved`: 解けた。
 */
export type TutorialMoveOutcome =
  | "ignored"
  | "continued"
  | "stepped"
  | "violated"
  | "solved";

export type Tutorial<
  RuleId extends string,
  Step extends TutorialStep<RuleId>,
  BoardState,
  Action,
> = {
  /** 上部に並べる順。 */
  rules: readonly TutorialRule<RuleId>[];
  /** 手を引く順。最後の手順を終えると手を離す。 */
  steps: readonly Step[];
  /** 手を離した後、解き終えるまでの一言。 */
  freePlay: TutorialMessage;
  /** 解き終えたときの一言。 */
  completion: TutorialMessage;
  start: () => BoardState;
  perform: (
    situation: TutorialSituation<RuleId, Step>,
    state: BoardState,
    action: Action,
  ) => { state: BoardState; outcome: TutorialMoveOutcome };
  /** ルールに合わないところが続いたときの一言。どのルールに当たったかを、今の盤面から具体的に言う。 */
  describeViolation: (
    situation: TutorialSituation<RuleId, Step>,
    state: BoardState,
  ) => TutorialMessage;
};

/**
 * - `playing`: 盤面を解いている。
 * - `solved`: 解けた。解けた盤面の演出を見せている間。
 * - `completed`: 演出を終え、終えたときの操作を待っている。
 */
export type TutorialPhase = "playing" | "solved" | "completed";

/**
 * - `stepIndex`: 今の手順の位置。手順の数と同じなら手を離している。
 * - `violated`: 最後の手でルールに合わないところができている。違反の一言は、違反がしばらく続いたときに出す側が出す。
 */
export type TutorialProgress<RuleId extends string, BoardState> = {
  boardState: BoardState;
  stepIndex: number;
  earnedRuleIds: readonly RuleId[];
  violated: boolean;
  phase: TutorialPhase;
};

function earnRule<RuleId extends string>(
  earnedRuleIds: readonly RuleId[],
  ruleId: RuleId | null,
): readonly RuleId[] {
  return ruleId === null || earnedRuleIds.includes(ruleId)
    ? earnedRuleIds
    : [...earnedRuleIds, ruleId];
}

/** 手順を始め、その手順で示すルールを手に入れる。 */
function enterStep<
  RuleId extends string,
  Step extends TutorialStep<RuleId>,
  BoardState,
  Action,
>(
  tutorial: Tutorial<RuleId, Step, BoardState, Action>,
  progress: TutorialProgress<RuleId, BoardState>,
  stepIndex: number,
): TutorialProgress<RuleId, BoardState> {
  const step = tutorial.steps[stepIndex];
  return {
    ...progress,
    stepIndex,
    earnedRuleIds: earnRule(
      progress.earnedRuleIds,
      step?.introducedRuleId ?? null,
    ),
  };
}

export function startTutorial<
  RuleId extends string,
  Step extends TutorialStep<RuleId>,
  BoardState,
  Action,
>(
  tutorial: Tutorial<RuleId, Step, BoardState, Action>,
): TutorialProgress<RuleId, BoardState> {
  return enterStep(
    tutorial,
    {
      boardState: tutorial.start(),
      stepIndex: 0,
      earnedRuleIds: [],
      violated: false,
      phase: "playing",
    },
    0,
  );
}

/** 手を引いている手順。手を離した後と、解いている間でなければ `null`。 */
export function getCurrentTutorialStep<
  RuleId extends string,
  Step extends TutorialStep<RuleId>,
  BoardState,
  Action,
>(
  tutorial: Tutorial<RuleId, Step, BoardState, Action>,
  progress: TutorialProgress<RuleId, BoardState>,
): Step | null {
  return progress.phase === "playing"
    ? (tutorial.steps[progress.stepIndex] ?? null)
    : null;
}

export function getTutorialSituation<
  RuleId extends string,
  Step extends TutorialStep<RuleId>,
  BoardState,
  Action,
>(
  tutorial: Tutorial<RuleId, Step, BoardState, Action>,
  progress: TutorialProgress<RuleId, BoardState>,
): TutorialSituation<RuleId, Step> {
  return {
    step: getCurrentTutorialStep(tutorial, progress),
    earnedRuleIds: progress.earnedRuleIds,
  };
}

/**
 * 盤面の上に出す一言。
 * 違反の一言は、切り替えの途中で一瞬だけ違反になった手で文言がちらつかないよう、出す側が違反の続いたこと（`violationSettled`）を確かめてから出す。
 */
export function getTutorialMessage<
  RuleId extends string,
  Step extends TutorialStep<RuleId>,
  BoardState,
  Action,
>(
  tutorial: Tutorial<RuleId, Step, BoardState, Action>,
  progress: TutorialProgress<RuleId, BoardState>,
  violationSettled: boolean,
): TutorialMessage {
  if (progress.phase !== "playing") {
    return tutorial.completion;
  }
  const situation = getTutorialSituation(tutorial, progress);
  if (progress.violated && violationSettled) {
    return tutorial.describeViolation(situation, progress.boardState);
  }
  return situation.step?.message ?? tutorial.freePlay;
}

/** 解いている間だけ操作を受け付ける。それ以外と、盤面が変わらない手では、同じ進行をそのまま返す。 */
export function performTutorialAction<
  RuleId extends string,
  Step extends TutorialStep<RuleId>,
  BoardState,
  Action,
>(
  tutorial: Tutorial<RuleId, Step, BoardState, Action>,
  progress: TutorialProgress<RuleId, BoardState>,
  action: Action,
): TutorialProgress<RuleId, BoardState> {
  if (progress.phase !== "playing") {
    return progress;
  }

  const { state, outcome } = tutorial.perform(
    getTutorialSituation(tutorial, progress),
    progress.boardState,
    action,
  );
  const moved = { ...progress, boardState: state, violated: false };
  switch (outcome) {
    case "ignored":
      return progress;
    case "continued":
      return moved;
    case "stepped":
      return enterStep(
        tutorial,
        moved,
        Math.min(progress.stepIndex + 1, tutorial.steps.length),
      );
    case "violated":
      return { ...moved, violated: true };
    case "solved":
      return { ...moved, phase: "solved" };
  }
}

/** 解けた盤面の演出を終えて、終えたときの操作を出す。 */
export function completeTutorial<RuleId extends string, BoardState>(
  progress: TutorialProgress<RuleId, BoardState>,
): TutorialProgress<RuleId, BoardState> {
  return progress.phase === "solved"
    ? { ...progress, phase: "completed" }
    : progress;
}
