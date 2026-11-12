import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import {
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
  type TutorialStageBoardIntro,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/hitofude-puzzle/assets/pictogram.svg?raw";
import { HITOFUDE_PUZZLE_DISPLAY_NAME } from "@/games/hitofude-puzzle/display-name";
import type {
  HitofudePuzzleBlockedMove,
  HitofudePuzzlePathNotice,
} from "@/games/hitofude-puzzle/play/use-hitofude-puzzle-play";
import type { HitofudePuzzleTraceStep } from "@/games/hitofude-puzzle/puzzle/transitions";
import {
  describeHitofudePuzzleTutorialHint,
  findHitofudePuzzleTutorialHint,
  findHitofudePuzzleTutorialViolation,
  getHitofudePuzzleTutorialProgressRatio,
  getHitofudePuzzleTutorialStepMarks,
  getHitofudePuzzleTutorialStepReasonCells,
  HITOFUDE_PUZZLE_TUTORIAL_PROGRESS_STEP_COUNT,
  HITOFUDE_PUZZLE_TUTORIAL_RECAP,
  type HitofudePuzzleTutorialAction,
  type HitofudePuzzleTutorialBoardState,
  type HitofudePuzzleTutorialMove,
  type HitofudePuzzleTutorialRuleId,
  type HitofudePuzzleTutorialStep,
  hitofudePuzzleTutorial,
  hitofudePuzzleTutorialBoard,
  isHitofudePuzzleTutorialDeadEnd,
} from "@/games/hitofude-puzzle/tutorial/tutorial";
import { findArrowKeyDirection } from "@/games/hitofude-puzzle/ui/arrow-key-direction";
import type { HitofudePuzzleCellCue } from "@/games/hitofude-puzzle/ui/board/cell-cue";
import { HitofudePuzzleBoard } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleBoard";
import { HitofudePuzzleGround } from "@/games/hitofude-puzzle/ui/HitofudePuzzleGround";
import { HitofudePuzzleHowToPlayDialog } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog";
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
  /** ゲームのホームから開いたときに渡す。渡さなければプレイ中に開いたとみなす。 */
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

/**
 * ルールに合わない道に、違反の一言と直す所の印で応えるまでの間。
 * なぞる指が、全マスを通れなくなるマスを一瞬通って戻る間に、一言と印がちらつかないようにする。
 */
const VIOLATION_MESSAGE_DELAY_MS = 500;

const goalPath = hitofudePuzzleTutorial.goal().path;

/** 解けた盤面の演出の間が、本番の完成演出の間に当たる。 */
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

type HitofudePuzzleTutorialMarks = {
  cells: readonly number[];
  pointed: boolean;
};

const noMarks: HitofudePuzzleTutorialMarks = { cells: [], pointed: false };

/** 印を付けるマスには、印だけを重ねる。 */
function getCellCues(
  progress: HitofudePuzzleTutorialProgress,
  completedStep: HitofudePuzzleTutorialStep | null,
  marks: HitofudePuzzleTutorialMarks,
  recallId: number | null,
): HitofudePuzzleCellCue[] {
  const acknowledgements = (completedStep?.route ?? [])
    .filter((cell) => !marks.cells.includes(cell))
    .map(
      (cell): HitofudePuzzleCellCue => ({
        cell,
        kind: "extended",
        id: progress.boardState.moveCount,
      }),
    );
  return [
    ...acknowledgements,
    ...marks.cells.map(
      (cell): HitofudePuzzleCellCue => ({
        cell,
        kind: "mark",
        recallId,
        pointed: marks.pointed,
      }),
    ),
  ];
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
  const [cueShownProgress, setCueShownProgress] =
    useState<HitofudePuzzleTutorialProgress | null>(null);
  const [settledViolationProgress, setSettledViolationProgress] =
    useState<HitofudePuzzleTutorialProgress | null>(null);
  const [hintRequestedProgress, setHintRequestedProgress] =
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
  const { step } = situation;
  const guiding = step !== null;
  const { boardState } = progress;
  const playing = progress.phase === "playing";
  const head = getHead(boardState);
  const recallId = recall?.progress === progress ? recall.id : null;
  const completedStep =
    steppedProgress === progress
      ? (hitofudePuzzleTutorial.steps[progress.stepIndex - 1] ?? null)
      : null;
  // 手順を終えた直後は、延ばしたマスと決め手を少し残して見せてから、次の印に替える。
  const lingering =
    playing && completedStep !== null && cueShownProgress !== progress;
  const violationSettled = settledViolationProgress === progress;
  const violation =
    playing && progress.violated && violationSettled
      ? findHitofudePuzzleTutorialViolation(situation, boardState)
      : null;
  const hintRequestable = playing && !guiding && !progress.violated;
  const hint =
    hintRequestable && hintRequestedProgress === progress
      ? findHitofudePuzzleTutorialHint(boardState)
      : null;
  const marks = getMarks();

  function getMarks(): HitofudePuzzleTutorialMarks {
    if (!playing || lingering) {
      return noMarks;
    }
    if (violation?.fixCell != null) {
      return { cells: [violation.fixCell], pointed: true };
    }
    if (guiding) {
      const cells = getHitofudePuzzleTutorialStepMarks(situation, boardState);
      return { cells, pointed: step.marks.length === 1 };
    }
    return hint === null ? noMarks : { cells: [hint.cell], pointed: true };
  }

  useHitofudePuzzleSoundEffects(
    toPathNotice(reaction),
    soundProgressByPhase[progress.phase],
    boardState.path.length,
  );

  useEffect(() => {
    if (!open || !lingering) {
      return;
    }
    const timer = window.setTimeout(
      () => setCueShownProgress(progress),
      NEXT_STEP_CUE_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, lingering]);

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
    // 先端を押すのはなぞり始めなので、印へ目を向けさせない。
    if (cell === getHead(current.boardState)) {
      return;
    }
    perform({ type: "press", cell });
  }

  function handleTraceStroke(traceStep: HitofudePuzzleTraceStep): void {
    if (!strokeSpentRef.current) {
      perform({ type: "trace", step: traceStep });
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
    setCueShownProgress(null);
    setSettledViolationProgress(null);
    setHintRequestedProgress(null);
    setRecall(null);
    setSteppedProgress(null);
    setReaction(null);
    changeProgress(startTutorial(hitofudePuzzleTutorial));
  }

  // ゴールはもう見せたので、入口を通さずに最初の手順から始める。
  function handleRestart(): void {
    restart();
    changeProgress(finishTutorialIntro(progressRef.current));
  }

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

  /** 見せる決め手が無ければ `null` で、覆わない。 */
  function getSpotlitCells(): number[] | null {
    if (!playing) {
      return null;
    }
    const violationCells =
      violation === null
        ? []
        : [
            head,
            ...violation.cells,
            ...(violation.fixCell === null ? [] : [violation.fixCell]),
          ];
    const focused = getFocusedCells();
    if (focused.length === 0 && violationCells.length === 0) {
      return null;
    }
    return [...new Set([...focused, ...violationCells])];
  }

  function getFocusedCells(): number[] {
    if (lingering) {
      return completedStep.reasonCells.length === 0
        ? []
        : [...completedStep.route, ...completedStep.reasonCells];
    }
    if (guiding) {
      const reasonCells = getHitofudePuzzleTutorialStepReasonCells(situation);
      // 印までなぞる道筋も、暗い所を通らせないよう元の明るさで残す。
      const routeCells = step.route.filter(
        (cell) => !boardState.path.includes(cell),
      );
      return reasonCells.length === 0
        ? []
        : [head, ...marks.cells, ...routeCells, ...reasonCells];
    }
    return hint?.kind === "extend" && hint.reasonCells.length > 0
      ? [head, hint.cell, ...hint.reasonCells]
      : [];
  }

  function getMessage(): TutorialMessage {
    if (lingering) {
      return completedStep.message;
    }
    // 押し直したときは、前の違反の一言を下げて、印のマスへ向かう手順の一言に戻す。
    if (recallId !== null && step !== null) {
      return step.message;
    }
    const hintMessage =
      hint === null ? null : describeHitofudePuzzleTutorialHint(hint);
    return (
      hintMessage ??
      getTutorialMessage(hitofudePuzzleTutorial, progress, {
        entry: finish.entry,
        violationSettled,
      })
    );
  }

  /** 最初の手順の印は、始めの盤面に巻き戻し終えてから出す。 */
  function renderBoard({
    scene,
    playing: scenePlaying,
    onSceneEnd,
  }: TutorialStageBoardIntro) {
    const solved =
      progress.phase === "solved" || progress.phase === "completed";
    const onBoard = scene === null && playing;
    return (
      <div
        ref={boardAreaRef}
        className="relative aspect-square w-[min(100cqw,100cqh,28rem)]"
      >
        <HitofudePuzzleTutorialRewind
          path={goalPath}
          active={scene === "start" && scenePlaying}
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
                (scene === "goal" && scenePlaying) ||
                progress.phase === "solved"
              }
              interactionDisabled={!playing}
              cues={
                onBoard
                  ? getCellCues(progress, completedStep, marks, recallId)
                  : []
              }
              spotlitCells={onBoard ? spotlitCells : null}
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

  const spotlitCells = getSpotlitCells();

  return (
    <TutorialOverlay
      presentation="stage"
      open={open}
      title={HITOFUDE_PUZZLE_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      background={<HitofudePuzzleGround />}
      intro={hitofudePuzzleTutorial.intro}
      recap={HITOFUDE_PUZZLE_TUTORIAL_RECAP}
      message={getMessage()}
      phase={progress.phase}
      spotlighting={spotlitCells !== null}
      progress={
        progress.phase === "solved" || progress.phase === "completed"
          ? 1
          : getHitofudePuzzleTutorialProgressRatio(boardState)
      }
      progressStepCount={HITOFUDE_PUZZLE_TUTORIAL_PROGRESS_STEP_COUNT}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={handleRestart}
      renderHowToPlayDialog={(control) => (
        <HitofudePuzzleHowToPlayDialog {...control} />
      )}
      onRequestHint={
        hintRequestable && hint === null
          ? () => setHintRequestedProgress(progress)
          : null
      }
      onClose={handleClose}
    />
  );
}
