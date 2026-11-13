import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/hitofude-puzzle/assets/pictogram.svg?raw";
import { HITOFUDE_PUZZLE_DISPLAY_NAME } from "@/games/hitofude-puzzle/display-name";
import type {
  HitofudePuzzleBlockedMove,
  HitofudePuzzlePathNotice,
} from "@/games/hitofude-puzzle/play/use-hitofude-puzzle-play";
import type { HitofudePuzzleTraceStep } from "@/games/hitofude-puzzle/puzzle/transitions";
import {
  findHitofudePuzzleTutorialHint,
  getHitofudePuzzleTutorialStepCells,
  getHitofudePuzzleTutorialStepReasonCells,
  type HitofudePuzzleTutorialAction,
  type HitofudePuzzleTutorialBoardState,
  type HitofudePuzzleTutorialHint,
  type HitofudePuzzleTutorialMove,
  type HitofudePuzzleTutorialRuleId,
  type HitofudePuzzleTutorialSituation,
  type HitofudePuzzleTutorialStep,
  hitofudePuzzleTutorial,
  hitofudePuzzleTutorialBoard,
  isHitofudePuzzleTutorialDeadEnd,
} from "@/games/hitofude-puzzle/tutorial/tutorial";
import { findArrowKeyDirection } from "@/games/hitofude-puzzle/ui/arrow-key-direction";
import type { HitofudePuzzleCellCue } from "@/games/hitofude-puzzle/ui/board/cell-cue";
import { HitofudePuzzleBoard } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleBoard";
import { HitofudePuzzleTutorialRewind } from "@/games/hitofude-puzzle/ui/HitofudePuzzleTutorial/HitofudePuzzleTutorialRewind";
import { useHitofudePuzzleSoundEffects } from "@/games/hitofude-puzzle/ui/use-hitofude-puzzle-sound-effects";
import type { GameProgress } from "@/games/play";
import {
  completeTutorial,
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialMessage,
  type TutorialPhase,
  type TutorialProgress,
} from "@/games/tutorial";

type HitofudePuzzleTutorialProps = {
  open: boolean;
  /** ゲームのホームから開いたときに渡す。終えたときに、ゲームのホームで開いているレベルを始める操作を出す。渡さなければプレイ中に開いたとして、閉じてプレイに戻る操作を出す。 */
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type HitofudePuzzleTutorialProgress = TutorialProgress<
  HitofudePuzzleTutorialRuleId,
  HitofudePuzzleTutorialBoardState
>;

type HitofudePuzzleTutorialReaction = {
  /** `id` は手のたびに増やし、もう一度始めても前の回と重ならないようにする。 */
  id: number;
  move: HitofudePuzzleTutorialMove;
  head: number;
};

/** 手を引いている間に印の無い所へ延ばそうとしたときの、印の押し直し。印の線を短く濃くして戻す。 */
type HitofudePuzzleTutorialRecall = {
  /** 延ばそうとするたびに増やし、続けて延ばそうとしても押し直す。 */
  id: number;
  /** 延ばそうとしたときの進行。手が進んだら押し直しを終える。 */
  progress: HitofudePuzzleTutorialProgress;
};

/** 手順の最後のマスまで延ばしてから、延ばしたマスと決め手を残して見せ、次の印に替えるまでの間。 */
const NEXT_STEP_CUE_DELAY_MS = 700;

const IDLE_HINT_DELAY_MS = 4000;

/**
 * ルールに合わない道に、違反の一言で応えるまでの間。
 * なぞる指が解から外れたマスを一瞬通って戻る間に、一言がちらつかないようにする。
 */
const VIOLATION_MESSAGE_DELAY_MS = 500;

const { steps } = hitofudePuzzleTutorial;
const goalPath = hitofudePuzzleTutorial.goal().path;

/** 本番と同じ効果音を、本番のプレイの進行に当てはめて鳴らす。解けた盤面の演出の間が、本番の完成演出の間に当たる。 */
const soundProgressByPhase = {
  intro: "playing",
  playing: "playing",
  solved: "clearing",
  completed: "result",
} as const satisfies Record<TutorialPhase, GameProgress>;

function getHead(state: HitofudePuzzleTutorialBoardState): number {
  return state.path.at(-1) ?? hitofudePuzzleTutorialBoard.start;
}

function toBlockedMove(
  reaction: HitofudePuzzleTutorialReaction | null,
): HitofudePuzzleBlockedMove | null {
  return reaction?.move.type === "blocked"
    ? {
        id: reaction.id,
        direction: reaction.move.direction,
        cell: reaction.move.cell,
      }
    : null;
}

function toPathNotice(
  reaction: HitofudePuzzleTutorialReaction | null,
): HitofudePuzzlePathNotice | null {
  if (reaction === null) {
    return null;
  }
  const { id, move, head } = reaction;
  switch (move.type) {
    case "extended":
      return { id, change: "extended", head };
    case "shortened":
      return { id, change: "shortened", head };
    case "blocked":
      return { id, change: "blocked", cell: move.cell, reason: move.reason };
  }
}

/** 印を付けるまでの間。0 ならすぐ付け、`null` なら付けない。 */
function getCueDelayMs(
  progress: HitofudePuzzleTutorialProgress,
  guiding: boolean,
  completedStep: HitofudePuzzleTutorialStep | null,
): number | null {
  if (progress.phase !== "playing") {
    return null;
  }
  if (!guiding) {
    return IDLE_HINT_DELAY_MS;
  }
  return completedStep === null ? 0 : NEXT_STEP_CUE_DELAY_MS;
}

function getCellCues(
  progress: HitofudePuzzleTutorialProgress,
  completedStep: HitofudePuzzleTutorialStep | null,
  markedCells: readonly number[],
  recallId: number | null,
): HitofudePuzzleCellCue[] {
  const acknowledgements: HitofudePuzzleCellCue[] = (completedStep?.cells ?? [])
    .filter((cell) => !markedCells.includes(cell))
    .map((cell) => ({
      cell,
      kind: "extended",
      id: progress.boardState.moveCount,
    }));
  return [
    ...acknowledgements,
    ...markedCells.map(
      (cell): HitofudePuzzleCellCue =>
        recallId === null
          ? { cell, kind: "hint", id: 0 }
          : { cell, kind: "recall", id: recallId },
    ),
  ];
}

/**
 * 手を引いている間に、画面全体の覆いから抜くマス。手を引いていなければ空。
 * - 印が出ている間は、なぞり始める先端、印のマス、その手順の決め手。
 * - 手順を終えてから次の印を出すまでの間は、延ばしたマスとその決め手。前の手順の決め手を次の印の決め手と読み違えさせないため、印と一緒に替える。
 * - 穴へ進もうとした手は、×の点いた穴を残す。
 */
function getSpotlitCells(
  situation: HitofudePuzzleTutorialSituation,
  progress: HitofudePuzzleTutorialProgress,
  completedStep: HitofudePuzzleTutorialStep | null,
  markedCells: readonly number[],
): number[] {
  if (situation.step === null) {
    return [];
  }
  const { boardState } = progress;
  const focused =
    markedCells.length > 0 || completedStep === null
      ? [
          getHead(boardState),
          ...markedCells,
          ...getHitofudePuzzleTutorialStepReasonCells(situation),
        ]
      : [...completedStep.cells, ...completedStep.reasonCells];
  const { lastMove } = boardState;
  return lastMove?.type === "blocked" && lastMove.cell !== null
    ? [...focused, lastMove.cell]
    : focused;
}

export function HitofudePuzzleTutorial({
  open,
  playStart,
  onClose,
}: HitofudePuzzleTutorialProps) {
  const [progress, setProgress] = useState<HitofudePuzzleTutorialProgress>(() =>
    startTutorial(hitofudePuzzleTutorial),
  );
  // 1回のなぞりで指が何マスも移ると、続けて手を受ける。描き直しを待たずに次の手を今の進行へ当てるため、進行を同時に持つ。
  const progressRef = useRef(progress);
  const [reaction, setReaction] =
    useState<HitofudePuzzleTutorialReaction | null>(null);
  const reactionIdRef = useRef(0);
  const [idleProgress, setIdleProgress] =
    useState<HitofudePuzzleTutorialProgress | null>(null);
  const [settledViolationProgress, setSettledViolationProgress] =
    useState<HitofudePuzzleTutorialProgress | null>(null);
  const [recall, setRecall] = useState<HitofudePuzzleTutorialRecall | null>(
    null,
  );
  // 手順の最後のマスまで延ばした手の進行。次の手が来るまで、延ばしたマスに応え、決め手を残して見せる。
  // 手を離した後に同じ道を引き直しても、手順を終えた手ではないので応えない。
  const [steppedProgress, setSteppedProgress] =
    useState<HitofudePuzzleTutorialProgress | null>(null);
  // 手順を終えたなぞりは、指を離すまで次の手順へ延ばさない。次の一言と印を見てから、次のなぞりを始めさせる。
  const strokeSpentRef = useRef(false);
  const boardAreaRef = useRef<HTMLDivElement>(null);
  const situation = getTutorialSituation(hitofudePuzzleTutorial, progress);
  const guiding = situation.step !== null;
  const { boardState } = progress;
  const recallId = recall?.progress === progress ? recall.id : null;
  const completedStep =
    steppedProgress === progress
      ? (steps[progress.stepIndex - 1] ?? null)
      : null;
  const cueDelayMs = getCueDelayMs(progress, guiding, completedStep);
  const cueShown =
    recallId !== null ||
    cueDelayMs === 0 ||
    (cueDelayMs !== null && idleProgress === progress);
  const hint: HitofudePuzzleTutorialHint | null =
    cueShown && !guiding ? findHitofudePuzzleTutorialHint(boardState) : null;
  const markedCells = !cueShown
    ? []
    : guiding
      ? getHitofudePuzzleTutorialStepCells(situation, boardState)
      : hint === null
        ? []
        : [hint.cell];

  useHitofudePuzzleSoundEffects(
    toPathNotice(reaction),
    soundProgressByPhase[progress.phase],
    boardState.path.length,
  );

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
    if (!open || !progress.violated) {
      return;
    }
    const timer = window.setTimeout(
      () => setSettledViolationProgress(progress),
      VIOLATION_MESSAGE_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress]);

  function changeProgress(next: HitofudePuzzleTutorialProgress): void {
    progressRef.current = next;
    setProgress(next);
  }

  const handleClearAnimationComplete = useCallback(() => {
    const completed = completeTutorial(progressRef.current);
    progressRef.current = completed;
    setProgress(completed);
  }, []);

  function handleIntroEnd(): void {
    changeProgress(finishTutorialIntro(progressRef.current));
  }

  /** 印の無い所へ延ばそうとしたら、赤は使わず、印の線を短く濃くして目を向けさせる。 */
  function recallMark(current: HitofudePuzzleTutorialProgress): void {
    setRecall((previous) => ({
      id: previous?.progress === current ? previous.id + 1 : 0,
      progress: current,
    }));
  }

  function perform(action: HitofudePuzzleTutorialAction): void {
    const current = progressRef.current;
    if (current.phase !== "playing") {
      return;
    }
    const next = performTutorialAction(hitofudePuzzleTutorial, current, action);
    if (next === current) {
      if (getTutorialSituation(hitofudePuzzleTutorial, current).step !== null) {
        recallMark(current);
      }
      return;
    }
    if (next.stepIndex !== current.stepIndex) {
      strokeSpentRef.current = true;
      setSteppedProgress(next);
    }
    changeProgress(next);
    const { lastMove } = next.boardState;
    if (lastMove !== null) {
      reactionIdRef.current += 1;
      setReaction({
        id: reactionIdRef.current,
        move: lastMove,
        head: getHead(next.boardState),
      });
    }
  }

  function handleBeginStroke(cell: number): void {
    strokeSpentRef.current = false;
    const current = progressRef.current;
    // 手を引いている間、先端を押すのはなぞり始めなので、印へ目を向けさせない。
    if (
      getTutorialSituation(hitofudePuzzleTutorial, current).step !== null &&
      cell === getHead(current.boardState)
    ) {
      return;
    }
    perform({ type: "press", cell });
  }

  function handleTraceStroke(step: HitofudePuzzleTraceStep): void {
    if (!strokeSpentRef.current) {
      perform({ type: "trace", step });
    }
  }

  function handleEndStroke(): void {
    strokeSpentRef.current = false;
  }

  const moveHeadByArrowKey = useEffectEvent((event: KeyboardEvent) => {
    const direction = findArrowKeyDirection(event.key);
    const dialog = boardAreaRef.current?.closest('[role="dialog"]');
    if (
      direction === null ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      !(event.target instanceof Node) ||
      !dialog?.contains(event.target)
    ) {
      return;
    }
    event.preventDefault();
    perform({ type: "move", direction });
  });

  // 本番と同じく、チュートリアルの中ではフォーカスがどこにあっても、矢印キーで先端を動かす。
  // 閉じるボタンなどのどの部品よりも先に（捕捉の段階で）受ける。
  useEffect(() => {
    if (!open || progress.phase !== "playing") {
      return;
    }
    function handleKeyDown(event: KeyboardEvent): void {
      moveHeadByArrowKey(event);
    }
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [open, progress.phase]);

  function restart(): void {
    strokeSpentRef.current = false;
    setIdleProgress(null);
    setSettledViolationProgress(null);
    setRecall(null);
    setSteppedProgress(null);
    setReaction(null);
    changeProgress(startTutorial(hitofudePuzzleTutorial));
  }

  // 終えたかどうかは残さないので、閉じたら次に開いたとき最初から始まるようにする。
  function handleClose(): void {
    restart();
    onClose();
  }

  function handleStartPlay(): void {
    restart();
    playStart?.onStart();
  }

  const finish: TutorialFinish = playStart
    ? {
        entry: "home",
        difficulty: playStart.difficulty,
        onStartPlay: handleStartPlay,
      }
    : { entry: "play", onReturnToPlay: handleClose };

  /**
   * 押し直したときは、前の違反の一言を下げて、印のマスへ向かう手順の一言に戻す。
   * 手を離した後に止まって手がかりの印を出したときは、印だけを出し、一言は足さない。
   */
  function getMessage(): TutorialMessage {
    if (recallId !== null && situation.step !== null) {
      return situation.step.message;
    }
    return getTutorialMessage(hitofudePuzzleTutorial, progress, {
      entry: finish.entry,
      violationSettled: settledViolationProgress === progress,
    });
  }

  /**
   * 導入ではゴールの道を見せ、始めの盤面の場面では、ゴールの道を始点まで巻き戻す。
   * 最初の手順の印は、導入の終わりに一言と同時に出す。
   */
  function renderBoard({
    scene,
    playing,
    onSceneEnd,
    messageShown,
  }: TutorialBoardIntro) {
    const solved =
      progress.phase === "solved" || progress.phase === "completed";
    const introMarksShown =
      progress.phase === "intro" && scene === null && messageShown;
    const cuesShown =
      scene === null && (progress.phase === "playing" || introMarksShown);
    return (
      <div
        ref={boardAreaRef}
        className="relative aspect-square w-[min(100cqw,100cqh,28rem)]"
      >
        <HitofudePuzzleTutorialRewind
          path={goalPath}
          active={scene === "start" && playing}
          onComplete={onSceneEnd}
        >
          {(rewindingPath) => (
            <HitofudePuzzleBoard
              board={hitofudePuzzleTutorialBoard}
              path={
                rewindingPath ?? (scene === "goal" ? goalPath : boardState.path)
              }
              isDeadEnd={
                scene === null && isHitofudePuzzleTutorialDeadEnd(boardState)
              }
              blockedMove={scene === null ? toBlockedMove(reaction) : null}
              solved={rewindingPath === null && (scene === "goal" || solved)}
              clearing={
                (scene === "goal" && playing) || progress.phase === "solved"
              }
              interactionDisabled={progress.phase !== "playing"}
              cues={
                cuesShown
                  ? getCellCues(
                      progress,
                      completedStep,
                      introMarksShown
                        ? getHitofudePuzzleTutorialStepCells(
                            situation,
                            boardState,
                          )
                        : markedCells,
                      recallId,
                    )
                  : []
              }
              spotlitCells={
                progress.phase === "playing" && scene === null
                  ? getSpotlitCells(
                      situation,
                      progress,
                      completedStep,
                      markedCells,
                    )
                  : []
              }
              onBeginStroke={handleBeginStroke}
              onTraceStroke={handleTraceStroke}
              onEndStroke={handleEndStroke}
              onClearAnimationComplete={
                scene === "goal" ? onSceneEnd : handleClearAnimationComplete
              }
            />
          )}
        </HitofudePuzzleTutorialRewind>
      </div>
    );
  }

  return (
    <TutorialOverlay
      open={open}
      title={HITOFUDE_PUZZLE_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      intro={hitofudePuzzleTutorial.intro}
      rules={hitofudePuzzleTutorial.rules.map((rule) => ({
        ...rule,
        earned: progress.earnedRuleIds.includes(rule.id),
        current: situation.step?.introducedRuleId === rule.id,
      }))}
      message={getMessage()}
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
