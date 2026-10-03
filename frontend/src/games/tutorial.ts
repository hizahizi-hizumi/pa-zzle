/**
 * 小さな固定盤面を実際に操作してルールと操作を学ぶチュートリアルの、ゲームに依存しない契約。
 * - `State`: ゲームの盤面状態。
 * - `Action`: 利用者の1回の操作。
 * - `Target`: 強調する対象（マスなど）。
 */

/**
 * 1つのステップ。指示した操作だけを受け付け、達成したら次のステップへ進む。
 * - `instruction`: 利用者に示す短い指示。
 * - `highlightedTargets`: 指示した操作の対象。空なら何も強調しない。
 * - `allows`: 操作前の状態で、その操作を受け付けるか。受け付けない操作は盤面を変えない。
 * - `isAchieved`: 受け付けた操作を盤面へ反映した後の状態と、その操作で、ステップを達成したか。
 */
export type TutorialStep<State, Action, Target> = {
  instruction: string;
  highlightedTargets: readonly Target[];
  allows: (state: State, action: Action) => boolean;
  isAchieved: (state: State, action: Action) => boolean;
};

/**
 * 1つのチュートリアル。
 * - `perform`: 操作を盤面へ反映する。ゲームのルールで成り立たない操作は同じ状態を返してよい。
 */
export type Tutorial<State, Action, Target> = {
  initialState: State;
  steps: readonly TutorialStep<State, Action, Target>[];
  perform: (state: State, action: Action) => State;
};

/** `achievedStepCount` がステップ数に達したらチュートリアルを終えている。 */
export type TutorialProgress<State> = {
  state: State;
  achievedStepCount: number;
};

export function startTutorial<State, Action, Target>(
  tutorial: Tutorial<State, Action, Target>,
): TutorialProgress<State> {
  return { state: tutorial.initialState, achievedStepCount: 0 };
}

/** 今取り組んでいるステップ。終えていれば `null`。 */
export function getCurrentTutorialStep<State, Action, Target>(
  tutorial: Tutorial<State, Action, Target>,
  progress: TutorialProgress<State>,
): TutorialStep<State, Action, Target> | null {
  return tutorial.steps[progress.achievedStepCount] ?? null;
}

export function isTutorialCompleted<State, Action, Target>(
  tutorial: Tutorial<State, Action, Target>,
  progress: TutorialProgress<State>,
): boolean {
  return progress.achievedStepCount >= tutorial.steps.length;
}

/** 今のステップが受け付けない操作と、終えた後の操作では、同じ進行をそのまま返す。 */
export function performTutorialAction<State, Action, Target>(
  tutorial: Tutorial<State, Action, Target>,
  progress: TutorialProgress<State>,
  action: Action,
): TutorialProgress<State> {
  const step = getCurrentTutorialStep(tutorial, progress);
  if (!step?.allows(progress.state, action)) {
    return progress;
  }

  const state = tutorial.perform(progress.state, action);
  return {
    state,
    achievedStepCount: step.isAchieved(state, action)
      ? progress.achievedStepCount + 1
      : progress.achievedStepCount,
  };
}
