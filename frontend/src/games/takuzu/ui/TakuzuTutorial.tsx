import { useCallback, useEffect, useRef, useState } from "react";

import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
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
  findTakuzuTutorialHintCellIndex,
  getTakuzuTutorialCellViews,
  getTakuzuTutorialLineViolations,
  getTakuzuTutorialStepCellIndices,
  getTakuzuTutorialStepReasonCellIndices,
  type TakuzuTutorialAction,
  type TakuzuTutorialBoardState,
  type TakuzuTutorialRuleId,
  type TakuzuTutorialSituation,
  takuzuTutorial,
} from "@/games/takuzu/tutorial/tutorial";
import type { TakuzuCellCue } from "@/games/takuzu/ui/board/cell-cue";
import { TakuzuClearAnimation } from "@/games/takuzu/ui/board/clear/TakuzuClearAnimation";
import {
  TakuzuBoard,
  type TakuzuBoardSpotlight,
} from "@/games/takuzu/ui/board/TakuzuBoard";
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

/**
 * 手順のマスを正しい手へ向かう途中にしたまま手が止まってから、盤面にルールに合わないところを見せるまでの間。
 * 教わったばかりの2回タップを、確かめながらゆっくり押す間隔でも出ないよう、違反の一言と揺れより長く取る。
 */
const TOWARD_STEP_REVEAL_DELAY_MS = 1000;

/** 置いたマスへの応えと決め手を残して見せてから、次の印とその決め手に替える。 */
const NEXT_STEP_CUE_DELAY_MS = 900;

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

/**
 * 印を付けるまでの間。0 ならすぐ付け、`null` なら付けない。
 * 手を引いている間は、印のマスにしか置けないので、違反があっても付け続ける。
 */
function getCueDelayMs(
  progress: TakuzuTutorialProgress,
  guiding: boolean,
): number | null {
  if (progress.phase !== "playing") {
    return null;
  }
  const { lastMove } = progress.boardState;
  if (!guiding) {
    return progress.violated || lastMove?.violated ? null : IDLE_HINT_DELAY_MS;
  }
  // 手順のマスを正しく置いた手は、置いたマスへの応えと決め手を覆いから抜いて見せてから、次の印へ替える。
  // ルールに合わないところが残る手では、待たずにすぐ印へ戻す。
  const fitted = !lastMove?.violated && (lastMove?.fitsStep ?? false);
  return fitted ? NEXT_STEP_CUE_DELAY_MS : 0;
}

/** 印は手を置くたびには付け直さず、押し直すとき（`recallId`）だけ線を濃くする。 */
function getCellCues(
  state: TakuzuTutorialBoardState,
  hintCellIndices: readonly number[],
  recallId: number | null,
): TakuzuCellCue[] {
  return [
    ...getMoveCues(state),
    ...hintCellIndices.map(
      (cellIndex): TakuzuCellCue =>
        recallId === null
          ? { cellIndex, kind: "hint", id: 0 }
          : { cellIndex, kind: "recall", id: recallId },
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

/**
 * 手を引いていなければ `null` で、覆いを出さない。
 * - 置いてから次の印を出すまでの間は、置いたマスとその決め手を抜く。前の手の決め手を、次の印の決め手と読み違えさせないため、印と一緒に替える。
 * - ルールに合わない3連続のマスと、個数超過・重複の行・列のマスは、どこがルールに当たっているかを読めるよう抜く。
 */
function getSpotlitCellIndices(
  situation: TakuzuTutorialSituation,
  state: TakuzuTutorialBoardState,
  hintShown: boolean,
  cellViews: readonly TakuzuCellView[],
  lineViolations: readonly TakuzuLine[],
): number[] | null {
  if (situation.step === null) {
    return null;
  }
  const { lastMove } = state;
  const focused = hintShown
    ? [
        ...situation.step.cellIndices,
        ...getTakuzuTutorialStepReasonCellIndices(situation, state),
      ]
    : lastMove
      ? [lastMove.cellIndex, ...lastMove.reasonCellIndices]
      : [];
  const runCellIndices = cellViews.flatMap((view, cellIndex) =>
    view.inViolatingRun ? [cellIndex] : [],
  );
  const lineCellIndices = lineViolations.flatMap((line) =>
    getTakuzuLineCellIndices(state.board.size, line),
  );
  return [...new Set([...focused, ...runCellIndices, ...lineCellIndices])];
}

function getBoardSpotlight(
  cellIndices: readonly number[] | null,
): TakuzuBoardSpotlight | null {
  return cellIndices === null ? null : { cellIndices, lineViolations: true };
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
  const [recall, setRecall] = useState<TakuzuTutorialRecall | null>(null);
  // 手順を終えた手の進行と、その手の前の進行。
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
  const cueDelayMs = getCueDelayMs(progress, guiding);
  const cueShown =
    (guiding && recallId !== null) ||
    cueDelayMs === 0 ||
    (cueDelayMs !== null && idleProgress === progress);

  useTakuzuSoundEffects(
    operation,
    soundProgressByPhase[progress.phase],
    boardState.board.size,
  );
  const idleHintCellIndex =
    cueShown && !guiding
      ? findTakuzuTutorialHintCellIndex(situation, boardState)
      : null;
  const hintCellIndices = !cueShown
    ? []
    : guiding
      ? getTakuzuTutorialStepCellIndices(situation, boardState)
      : idleHintCellIndex === null
        ? []
        : [idleHintCellIndex];

  useEffect(() => {
    if (!open || cueDelayMs === null || cueDelayMs === 0) {
      return;
    }
    const timer = window.setTimeout(
      () => setIdleProgress(progress),
      cueDelayMs,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, cueDelayMs]);

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
        TOWARD_STEP_REVEAL_DELAY_MS,
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
    setSettledViolationProgress(null);
    setSettledTowardStepProgress(null);
    setRecall(null);
    setFinishedStep(null);
    setOperation(null);
    setProgress(startTutorial(takuzuTutorial));
  }

  function handleClose(): void {
    restart();
    onClose();
  }

  function handleStartPlay(): void {
    restart();
    playStart?.onStart();
  }

  /** 始めの盤面の場面では、解き終えた盤面から置いたタイルを消し、消し終えたら始めの盤面に替える。 */
  function renderBoard({ scene, playing, onSceneEnd }: TutorialBoardIntro) {
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
              cells={getTakuzuTutorialCellViews(
                situation,
                shownBoardState,
                towardStepSettled,
              )}
              lineViolations={getTakuzuTutorialLineViolations(
                situation,
                shownBoardState,
                towardStepSettled,
              )}
              operation={operation}
              interactionDisabled={progress.phase !== "playing"}
              spotlight={
                progress.phase === "playing" && !goalShown
                  ? getBoardSpotlight(
                      getSpotlitCellIndices(
                        situation,
                        boardState,
                        cueShown,
                        cellViews,
                        getTakuzuTutorialLineViolations(
                          situation,
                          boardState,
                          towardStepSettled,
                        ),
                      ),
                    )
                  : null
              }
              cues={
                // 完成の波と完成した盤面に、最後の手の合図を残さない。
                progress.phase === "playing"
                  ? getCellCues(boardState, hintCellIndices, recallId)
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

  // 次の印を付けるまでは、覆いから抜いた置いたマスと決め手に合わせて、一言とルールの並びも終えた手順のまま見せる。
  const shownProgress =
    guiding && !cueShown && finishedStep?.progress === progress
      ? finishedStep.previous
      : progress;
  const shownSituation = getTutorialSituation(takuzuTutorial, shownProgress);

  const finish: TutorialFinish = playStart
    ? {
        entry: "home",
        difficulty: playStart.difficulty,
        onStartPlay: handleStartPlay,
      }
    : { entry: "play", onReturnToPlay: handleClose };

  return (
    <TutorialOverlay
      open={open}
      title={TAKUZU_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      intro={takuzuTutorial.intro}
      rules={takuzuTutorial.rules.map((rule) => ({
        ...rule,
        earned: shownProgress.earnedRuleIds.includes(rule.id),
        current: shownSituation.step?.introducedRuleId === rule.id,
      }))}
      message={getTutorialMessage(takuzuTutorial, shownProgress, {
        entry: finish.entry,
        violationSettled: shownProgress === progress && violationSettled,
      })}
      phase={progress.phase}
      guiding={progress.phase === "playing" && guiding}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={restart}
      onClose={handleClose}
    />
  );
}
