import { useCallback, useEffect, useRef, useState } from "react";
import {
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
  type TutorialStageBoardIntro,
} from "@/components/TutorialOverlay";
import type { GameProgress } from "@/games/play";
import pictogramSvg from "@/games/takuzu/assets/pictogram.svg?raw";
import { TAKUZU_DISPLAY_NAME } from "@/games/takuzu/display-name";
import type { TakuzuOperation } from "@/games/takuzu/play/use-takuzu-play";
import {
  getTakuzuLineCellIndices,
  type TakuzuCell,
  type TakuzuLine,
  type TakuzuTile,
} from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import type { TakuzuCellView } from "@/games/takuzu/session/session";
import {
  describeTakuzuTutorialMidwayViolation,
  describeTakuzuTutorialRule,
  describeTakuzuTutorialStep,
  findTakuzuTutorialHint,
  findTakuzuTutorialViolationFixCellIndex,
  getTakuzuTutorialCellViews,
  getTakuzuTutorialLineViolations,
  getTakuzuTutorialProgressRatio,
  getTakuzuTutorialStepCellIndices,
  getTakuzuTutorialStepReasonCellIndices,
  TAKUZU_TUTORIAL_PROGRESS_STEP_COUNT,
  type TakuzuTutorialAction,
  type TakuzuTutorialBoardState,
  type TakuzuTutorialRuleId,
  takuzuTutorial,
} from "@/games/takuzu/tutorial/tutorial";
import type { TakuzuCellCue } from "@/games/takuzu/ui/board/cell-cue";
import { TakuzuClearAnimation } from "@/games/takuzu/ui/board/clear/TakuzuClearAnimation";
import { TakuzuBoard } from "@/games/takuzu/ui/board/TakuzuBoard";
import { TakuzuGround } from "@/games/takuzu/ui/TakuzuGround";
import { TakuzuHowToPlayDialog } from "@/games/takuzu/ui/TakuzuHowToPlayDialog";
import { TakuzuTutorialRewind } from "@/games/takuzu/ui/TakuzuTutorial/TakuzuTutorialRewind";
import { useTakuzuSoundEffects } from "@/games/takuzu/ui/use-takuzu-sound-effects";
import {
  completeTutorial,
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialPhase,
  type TutorialProgress,
} from "@/games/tutorial";

type TakuzuTutorialProps = {
  open: boolean;
  /** ゲームのホームから開いたときだけ渡す。渡さなければプレイ中に開いたとみなす。 */
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type TakuzuTutorialProgress = TutorialProgress<
  TakuzuTutorialRuleId,
  TakuzuTutorialBoardState
>;

/**
 * 空き→四角→丸と切り替える途中の四角が一瞬だけ違反になっても一言が替わらないよう、違反が続いたときだけ応える。
 * 盤面の違反の印の遅れ（240ms）より長く取り、ゆっくり続けて押す間隔（300〜400ms）でも出ず、手を止めればすぐ分かる長さにする。
 */
const VIOLATION_REACTION_DELAY_MS = 500;

// 教わったばかりの2回タップを、確かめながらゆっくり押す間隔でも出ないよう、違反の一言と揺れより長く取る。
const TOWARD_STEP_VIOLATION_REVEAL_DELAY_MS = 1000;

/** 置いたマスへの応えと決め手を残して見せてから、次の印とその決め手に替える。 */
const NEXT_STEP_CUE_DELAY_MS = 900;

/** 2マスを自分で埋める手順で、手が止まってから指を出すまでの間。 */
const IDLE_HINT_DELAY_MS = 4000;

const goalBoardState = takuzuTutorial.goal();

/** 手を引いている間に印の無いマスを押されたときの、印の押し直し。 */
type TakuzuTutorialRecall = {
  /** 押されるたびに増やし、続けて押されても押し直す。 */
  id: number;
  /** 押されたときの進行。手が進んだら押し直しを終える。 */
  progress: TakuzuTutorialProgress;
};

/** 本番と同じ効果音を、本番のプレイの進行に当てはめて鳴らす。解けた盤面の演出の間が、本番の完成演出の間に当たる。 */
const soundProgressByPhase = {
  intro: "playing",
  playing: "playing",
  solved: "clearing",
  completed: "result",
} as const satisfies Record<TutorialPhase, GameProgress>;

/** 手を離した後に手がかりを求められるか。違反がある間は、直すことに向かわせるため求めさせない。 */
function canRequestHint(progress: TakuzuTutorialProgress): boolean {
  const { lastMove } = progress.boardState;
  return (
    progress.phase === "playing" && !progress.violated && !lastMove?.violated
  );
}

/** 印は手を置くたびには付け直さず、押し直すとき（`recallId`）だけ線を濃くする。 */
function getCellCues(
  state: TakuzuTutorialBoardState,
  hintCellIndices: readonly number[],
  recallId: number | null,
  pointed: boolean,
): TakuzuCellCue[] {
  return [
    ...getMoveCues(state),
    ...hintCellIndices.map(
      (cellIndex, order): TakuzuCellCue => ({
        cellIndex,
        kind: recallId === null ? "hint" : "recall",
        id: recallId ?? 0,
        // 指は1本だけにして、置く順を迷わせない。
        pointed: pointed && order === 0,
      }),
    ),
  ];
}

function getMoveCues({
  lastMove,
  moveCount,
}: TakuzuTutorialBoardState): TakuzuCellCue[] {
  if (!lastMove || lastMove.violated) {
    return [];
  }
  return lastMove.fitsStep
    ? [{ cellIndex: lastMove.cellIndex, kind: "fitted", id: moveCount }]
    : [];
}

function listViolatingCellIndices(
  size: number,
  cellViews: readonly TakuzuCellView[],
  lineViolations: readonly TakuzuLine[],
): number[] {
  return [
    ...cellViews.flatMap((view, cellIndex) =>
      view.inViolatingRun ? [cellIndex] : [],
    ),
    ...lineViolations.flatMap((line) => getTakuzuLineCellIndices(size, line)),
  ];
}

export function TakuzuTutorial({
  open,
  playStart,
  onClose,
}: TakuzuTutorialProps) {
  const [progress, setProgress] = useState<TakuzuTutorialProgress>(() =>
    startTutorial(takuzuTutorial),
  );
  const [idleProgress, setIdleProgress] =
    useState<TakuzuTutorialProgress | null>(null);
  const [settledViolationProgress, setSettledViolationProgress] =
    useState<TakuzuTutorialProgress | null>(null);
  const [settledTowardStepProgress, setSettledTowardStepProgress] =
    useState<TakuzuTutorialProgress | null>(null);
  const [hintRequestedProgress, setHintRequestedProgress] =
    useState<TakuzuTutorialProgress | null>(null);
  const [recall, setRecall] = useState<TakuzuTutorialRecall | null>(null);
  const [lingerEndedProgress, setLingerEndedProgress] =
    useState<TakuzuTutorialProgress | null>(null);
  // 手順を終えた手の進行と、その手の前の進行。置いたマスと決め手を残して見せる間は、一言も終えた手順のままにする。
  const [finishedStep, setFinishedStep] = useState<{
    progress: TakuzuTutorialProgress;
    previous: TakuzuTutorialProgress;
  } | null>(null);
  const [operation, setOperation] = useState<TakuzuOperation | null>(null);
  // 開き直しても同じ知らせとみなされないよう、もう一度始めても数え直さない。
  const operationIdRef = useRef(0);
  const reactionTimerRef = useRef<number | null>(null);
  const situation = getTutorialSituation(takuzuTutorial, progress);
  const guiding = situation.step !== null;
  const { boardState } = progress;
  const towardStepSettled = settledTowardStepProgress === progress;
  const cellViews = getTakuzuTutorialCellViews(
    situation,
    boardState,
    towardStepSettled,
  );
  const violationSettled = settledViolationProgress === progress;
  const recallId = recall?.progress === progress ? recall.id : null;
  const lineViolations = getTakuzuTutorialLineViolations(
    situation,
    boardState,
    towardStepSettled,
  );

  // ルールを教える手順を終えたら、置いたマスと決め手を少し残して見せてから、次の手順か手を離した後へ替える。
  const finishedSituation =
    progress.phase === "playing" && finishedStep?.progress === progress
      ? getTutorialSituation(takuzuTutorial, finishedStep.previous)
      : null;
  const lingeringStep =
    finishedSituation?.step?.lesson && lingerEndedProgress !== progress
      ? finishedSituation.step
      : null;
  // 2マスを自分で埋める手順は、手が止まったら指を出して、最初の1手を助ける。
  const choosingStepCells =
    guiding && (situation.step?.cellIndices.length ?? 0) > 1;
  const idleHintDelayMs =
    lingeringStep === null && choosingStepCells && progress.phase === "playing"
      ? IDLE_HINT_DELAY_MS
      : null;
  const idle = idleHintDelayMs !== null && idleProgress === progress;
  // 手を離した後は、自分で解いている間に割り込まないよう、手がかりは求められたときだけ見せる。
  const hintRequestable =
    !guiding && lingeringStep === null && canRequestHint(progress);
  const idleHint =
    hintRequestable && hintRequestedProgress === progress
      ? findTakuzuTutorialHint(situation, boardState)
      : null;
  const stepCueShown =
    progress.phase === "playing" && guiding && lingeringStep === null;
  // 手を離した後に違反が続いたら、直す所を迷わせないよう、置き直すマスに印を付ける。
  const violationFixCellIndex =
    !guiding && violationSettled
      ? findTakuzuTutorialViolationFixCellIndex(situation, boardState)
      : null;
  const hintCellIndices = stepCueShown
    ? getTakuzuTutorialStepCellIndices(situation, boardState)
    : idleHint
      ? [idleHint.cellIndex]
      : violationFixCellIndex !== null
        ? [violationFixCellIndex]
        : [];
  // 押すマスが1つに決まる手順だけ指で指す。2マスを自分で選んで埋める手順は、印だけにして順番と形を決めさせる。
  const pointed = stepCueShown && (!choosingStepCells || idle);

  useTakuzuSoundEffects(
    operation,
    soundProgressByPhase[progress.phase],
    boardState.board.size,
  );

  useEffect(() => {
    if (!open || lingeringStep === null) {
      return;
    }
    const timer = window.setTimeout(
      () => setLingerEndedProgress(progress),
      NEXT_STEP_CUE_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, lingeringStep]);

  useEffect(() => {
    if (!open || idleHintDelayMs === null) {
      return;
    }
    const timer = window.setTimeout(
      () => setIdleProgress(progress),
      idleHintDelayMs,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, idleHintDelayMs]);

  useEffect(() => {
    return () => {
      if (reactionTimerRef.current !== null) {
        window.clearTimeout(reactionTimerRef.current);
      }
    };
  }, []);

  function cancelPendingReaction(): void {
    if (reactionTimerRef.current !== null) {
      window.clearTimeout(reactionTimerRef.current);
      reactionTimerRef.current = null;
    }
  }

  /** 手の後、盤面が変わらないまま `delayMs` が過ぎたら、その手の進行を `settle` に渡す。 */
  function scheduleReaction(
    next: TakuzuTutorialProgress,
    delayMs: number,
    settle: (progress: TakuzuTutorialProgress) => void,
  ): void {
    reactionTimerRef.current = window.setTimeout(() => {
      reactionTimerRef.current = null;
      settle(next);
    }, delayMs);
  }

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  function notifyOperation(
    notice:
      | { type: "placed"; tile: TakuzuTile }
      | { type: "emptied" }
      | { type: "invalid"; cellIndex: number },
  ): void {
    operationIdRef.current += 1;
    setOperation({ ...notice, id: operationIdRef.current });
  }

  /** 印の無いマスを押されたら、赤は使わず、印の線を短く濃くして目を向けさせる。 */
  function recallHint(): void {
    setRecall((current) => ({ id: (current?.id ?? 0) + 1, progress }));
  }

  function perform(action: TakuzuTutorialAction): void {
    if (progress.phase !== "playing") {
      return;
    }
    if (cellViews[action.cellIndex]?.given) {
      notifyOperation({ type: "invalid", cellIndex: action.cellIndex });
      if (guiding) {
        recallHint();
      }
      return;
    }
    const next = performTutorialAction(takuzuTutorial, progress, action);
    if (next === progress) {
      if (guiding) {
        recallHint();
      }
      return;
    }
    const placed = next.boardState.board.cells[action.cellIndex] ?? null;
    notifyOperation(
      placed === null ? { type: "emptied" } : { type: "placed", tile: placed },
    );
    if (next.stepIndex !== progress.stepIndex) {
      setFinishedStep({ progress: next, previous: progress });
    }
    setProgress(next);
    cancelPendingReaction();
    if (next.violated) {
      scheduleReaction(
        next,
        VIOLATION_REACTION_DELAY_MS,
        setSettledViolationProgress,
      );
    } else if (next.boardState.lastMove?.towardStep) {
      scheduleReaction(
        next,
        TOWARD_STEP_VIOLATION_REVEAL_DELAY_MS,
        setSettledTowardStepProgress,
      );
    }
  }

  function handleCycleCell(
    cellIndex: number,
    direction: TakuzuCycleDirection,
  ): void {
    perform({ type: "cycle", cellIndex, direction });
  }

  function handlePlaceCell(cellIndex: number, cell: TakuzuCell): void {
    perform({ type: "place", cellIndex, cell });
  }

  function restart(): void {
    cancelPendingReaction();
    setIdleProgress(null);
    setHintRequestedProgress(null);
    setSettledViolationProgress(null);
    setSettledTowardStepProgress(null);
    setRecall(null);
    setLingerEndedProgress(null);
    setFinishedStep(null);
    setOperation(null);
    setProgress(startTutorial(takuzuTutorial));
  }

  // ゴールはもう見せたので、入口を通さずに最初の手順から始める。
  function handleRestart(): void {
    restart();
    setProgress(finishTutorialIntro);
  }

  // 終えたかどうかは残さないので、閉じたら次に開いたとき入口から始まるようにする。
  function handleClose(): void {
    restart();
    onClose();
  }

  function handleStartPlay(): void {
    restart();
    playStart?.onStart();
  }

  const spotlitCellIndices = getSpotlitCellIndices();

  /**
   * 見せる物が無ければ `null` で、覆わない。
   * - ルールに合わないところのマスは、どこがルールに当たっているかを読めるよう抜く。手を離した後は、巡回の途中で瞬かないよう、違反が続いたときだけ抜く。
   */
  function getSpotlitCellIndices(): number[] | null {
    if (progress.phase !== "playing") {
      return null;
    }
    const shownStepSituation = lingeringStep ? finishedSituation : situation;
    const shownStep = lingeringStep ?? situation.step;
    const reasonCellIndices =
      shownStep && shownStepSituation
        ? getTakuzuTutorialStepReasonCellIndices(shownStepSituation, boardState)
        : (idleHint?.reasonCellIndices ?? []);
    const focusedCellIndices =
      reasonCellIndices.length === 0
        ? []
        : [
            ...(shownStep?.cellIndices ??
              (idleHint ? [idleHint.cellIndex] : [])),
            ...reasonCellIndices,
          ];
    const violatingCellIndices =
      guiding || violationSettled
        ? listViolatingCellIndices(
            boardState.board.size,
            cellViews,
            lineViolations,
          )
        : [];
    const cellIndices = [
      ...new Set([...focusedCellIndices, ...violatingCellIndices]),
    ];
    return cellIndices.length === 0 ? null : cellIndices;
  }

  /** 始めの盤面の場面では、解き終えた盤面から置いたタイルを消し、消し終えたら始めの盤面に替える。 */
  function renderBoard({
    scene,
    playing,
    onSceneEnd,
  }: TutorialStageBoardIntro) {
    const goalShown = scene === "goal" || (scene === "start" && playing);
    const shownBoardState = goalShown ? goalBoardState : boardState;
    return (
      <div className="aspect-square w-[min(100cqw,100cqh,28rem)]">
        <TakuzuClearAnimation
          active={progress.phase === "solved" || (scene === "goal" && playing)}
          onComplete={
            scene === "goal" ? onSceneEnd : handleClearAnimationComplete
          }
        >
          <TakuzuTutorialRewind
            active={scene === "start" && playing}
            onComplete={onSceneEnd}
          >
            <TakuzuBoard
              size={shownBoardState.board.size}
              cells={
                goalShown
                  ? getTakuzuTutorialCellViews(situation, shownBoardState)
                  : cellViews
              }
              lineViolations={goalShown ? [] : lineViolations}
              operation={operation}
              interactionDisabled={progress.phase !== "playing"}
              spotlitCellIndices={scene === null ? spotlitCellIndices : null}
              cues={
                // 完成の波と完成した盤面に、最後の手の合図を残さない。
                progress.phase === "playing" && scene === null
                  ? getCellCues(boardState, hintCellIndices, recallId, pointed)
                  : []
              }
              onCycleCell={handleCycleCell}
              onPlaceCell={handlePlaceCell}
            />
          </TakuzuTutorialRewind>
        </TakuzuClearAnimation>
      </div>
    );
  }

  // 終えた手順を残して見せる間は、置いたマスと決め手に合わせて、一言も終えた手順のままにする。
  const shownProgress =
    lingeringStep && finishedStep ? finishedStep.previous : progress;
  const shownSituation = getTutorialSituation(takuzuTutorial, shownProgress);

  const finish: TutorialFinish = playStart
    ? {
        entry: "home",
        difficulty: playStart.difficulty,
        onStartPlay: handleStartPlay,
      }
    : { entry: "play", onReturnToPlay: handleClose };

  const baseMessage = getTutorialMessage(takuzuTutorial, shownProgress, {
    entry: finish.entry,
    violationSettled: shownProgress === progress && violationSettled,
  });
  const shownStep = shownSituation.step;
  // 考えずに1回押した四角がルールに当たったまま手が止まったら、そのルールの違反として言う。
  const midwayViolationMessage =
    guiding && towardStepSettled
      ? describeTakuzuTutorialMidwayViolation(situation, boardState)
      : null;
  // 手がかりには、そのマスを決めるルールの一言を添える。
  const hintMessage =
    idleHint?.ruleId && baseMessage === takuzuTutorial.freePlay
      ? describeTakuzuTutorialRule(idleHint.ruleId)
      : null;
  const message =
    midwayViolationMessage ??
    (shownStep !== null && baseMessage === shownStep.message
      ? describeTakuzuTutorialStep(shownStep, shownProgress.boardState)
      : (hintMessage ?? baseMessage));

  return (
    <TutorialOverlay
      presentation="stage"
      open={open}
      title={TAKUZU_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      background={<TakuzuGround />}
      intro={takuzuTutorial.intro}
      recap={takuzuTutorial.rules.map((rule) => rule.label)}
      message={message}
      phase={progress.phase}
      spotlighting={spotlitCellIndices !== null}
      progress={
        progress.phase === "playing" || progress.phase === "intro"
          ? getTakuzuTutorialProgressRatio(boardState)
          : 1
      }
      progressStepCount={TAKUZU_TUTORIAL_PROGRESS_STEP_COUNT}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={handleRestart}
      renderHowToPlayDialog={(control) => (
        <TakuzuHowToPlayDialog {...control} />
      )}
      onRequestHint={
        hintRequestable && idleHint === null
          ? () => setHintRequestedProgress(progress)
          : null
      }
      onClose={handleClose}
    />
  );
}
