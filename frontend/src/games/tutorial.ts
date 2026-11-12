/**
 * チュートリアルの、ゲームに依存しない契約。
 * 手順の進行、手に入れたルール、手順ごとの一言を扱い、盤面と判定はゲームが持つ。
 * - `RuleId`: ゲームのルールの識別子。
 * - `BoardState`: 盤面を解いている途中の状態。
 * - `Action`: 利用者の1回の操作。
 */

/**
 * 手順ごとに出す一言。`detail` は見出しを補う短い一文。
 * 一言と導入の文は、`\n` の所で改行して見せ、それ以外は画面が文節の切れ目で折り返す。
 */
export type TutorialMessage = {
  headline: string;
  detail: string | null;
};

/** 手順で手に入れるルール。`label` は、そのルールを言う一文。 */
export type TutorialRule<RuleId extends string> = {
  id: RuleId;
  label: string;
};

/**
 * 手を引く1手順。ゲームは、手順で操作させるところと、そこを終えたとみなす盤面を、この型を広げて持つ。
 * - `message`: この手順の間の一言。
 * - `introducedRuleId`: この手順で示すルール。
 */
export type TutorialStep<RuleId extends string> = {
  message: TutorialMessage;
  introducedRuleId: RuleId | null;
};

/**
 * ゲームが手を判定するときの、今の手順と手に入れたルール。
 * - `step`: 手を引いている手順。手順を終えて手を離した後は `null`。
 * - `earnedRuleIds`: 手に入れたルール。
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
 * - `ignored`: 何も起きなかった。手を引いている間に、手順で操作させていないところを押した場合も含む。
 * - `continued`: 盤面が変わった。ルールに合わないところは無く、手順もまだ終えていない。
 * - `stepped`: 手順で操作させたところを、手順どおりにした。次の手順へ進む。
 * - `violated`: 手に入れたルールに合わない手だった。盤面にルールに合わないところができた手も、ルールで成り立たず盤面が変わらなかった手も含む。
 * - `solved`: 解けた。
 */
export type TutorialMoveOutcome =
  | "ignored"
  | "continued"
  | "stepped"
  | "violated"
  | "solved";

/**
 * 操作より先に見せる、パズルの入口。
 * - `purpose`: 何をするパズルかの一文。名前の下に出す。
 * - `goalCaption`: 解き終えた盤面に添える一言。
 * - `startCaption`: 始めの盤面に添える一言。`TutorialOverlay` の `scrim` でだけ使う。
 */
export type TutorialIntro = {
  purpose: string;
  goalCaption: string;
  startCaption?: string;
};

/**
 * チュートリアルを開いた場所。終えた後の行き先と、解き終えたときの一言が変わる。
 * - `home`: ゲームのホーム。
 * - `play`: プレイ中のメニュー。
 */
export type TutorialEntry = "home" | "play";

export type Tutorial<
  RuleId extends string,
  Step extends TutorialStep<RuleId>,
  BoardState,
  Action,
> = {
  intro: TutorialIntro;
  /** ルールの並び。解き終えたときの振り返りにこの並びを使うゲームは、この順に見せる。 */
  rules: readonly TutorialRule<RuleId>[];
  /** 手を引く順。最後の手順を終えると手を離す。 */
  steps: readonly Step[];
  /** 手を離した後、解き終えるまでの一言。 */
  freePlay: TutorialMessage;
  /** 解き終えたときの一言。 */
  completion: Record<TutorialEntry, TutorialMessage>;
  start: () => BoardState;
  /** 解き終えた盤面。 */
  goal: () => BoardState;
  perform: (
    situation: TutorialSituation<RuleId, Step>,
    state: BoardState,
    action: Action,
  ) => { state: BoardState; outcome: TutorialMoveOutcome };
  /** ルールに合わないところが続いたときの一言。 */
  describeViolation: (
    situation: TutorialSituation<RuleId, Step>,
    state: BoardState,
  ) => TutorialMessage;
};

/**
 * - `intro`: 開いたときの導入を見せている。操作を受け付けず、導入を終えると最初の手順から手を引く。
 * - `playing`: 盤面を解いている。
 * - `solved`: 解けた。解けた盤面の演出を見せている間。
 * - `completed`: 演出を終え、終えたときの操作を待っている。
 */
export type TutorialPhase = "intro" | "playing" | "solved" | "completed";

/**
 * - `stepIndex`: 今の手順の位置。手順の数と同じなら手を離している。
 * - `violated`: 最後の手が、手に入れたルールに合わなかった。違反の一言は、違反が続いたことを出す側が確かめてから出す。
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
      phase: "intro",
    },
    0,
  );
}

export function getCurrentTutorialStep<
  RuleId extends string,
  Step extends TutorialStep<RuleId>,
  BoardState,
  Action,
>(
  tutorial: Tutorial<RuleId, Step, BoardState, Action>,
  progress: TutorialProgress<RuleId, BoardState>,
): Step | null {
  return progress.phase === "intro" || progress.phase === "playing"
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

export function getTutorialMessage<
  RuleId extends string,
  Step extends TutorialStep<RuleId>,
  BoardState,
  Action,
>(
  tutorial: Tutorial<RuleId, Step, BoardState, Action>,
  progress: TutorialProgress<RuleId, BoardState>,
  {
    entry,
    // 違反が続いたか。切り替えの途中で一瞬だけ違反になる手で文言がちらつかないよう、出す側が確かめる。一瞬の違反が起きないゲームは常に `true` を渡す。
    violationSettled,
  }: { entry: TutorialEntry; violationSettled: boolean },
): TutorialMessage {
  if (progress.phase === "solved" || progress.phase === "completed") {
    return tutorial.completion[entry];
  }
  const situation = getTutorialSituation(tutorial, progress);
  if (progress.violated && violationSettled) {
    return tutorial.describeViolation(situation, progress.boardState);
  }
  return situation.step?.message ?? tutorial.freePlay;
}

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

export function finishTutorialIntro<RuleId extends string, BoardState>(
  progress: TutorialProgress<RuleId, BoardState>,
): TutorialProgress<RuleId, BoardState> {
  return progress.phase === "intro"
    ? { ...progress, phase: "playing" }
    : progress;
}

export function completeTutorial<RuleId extends string, BoardState>(
  progress: TutorialProgress<RuleId, BoardState>,
): TutorialProgress<RuleId, BoardState> {
  return progress.phase === "solved"
    ? { ...progress, phase: "completed" }
    : progress;
}
