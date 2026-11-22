import { useCallback, useEffect, useRef, useState } from "react";
import { TutorialCrossFadeIntroScene } from "@/components/TutorialCrossFadeIntroScene";
import { TutorialCue } from "@/components/TutorialCue";
import {
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
  type TutorialStageBoardIntro,
} from "@/components/TutorialOverlay";
import { UndoButton } from "@/components/UndoButton";
import pictogramSvg from "@/games/shuttle-parking/assets/pictogram.svg?raw";
import { SHUTTLE_PARKING_DISPLAY_NAME } from "@/games/shuttle-parking/display-name";
import { createShuttleParkingExitTimeline } from "@/games/shuttle-parking/play/exit-timeline";
import type { ShuttleParkingOperation } from "@/games/shuttle-parking/play/use-shuttle-parking-play";
import type { ShuttleParkingCarId } from "@/games/shuttle-parking/puzzle/lot";
import {
  canUndoShuttleParkingTutorial,
  findShuttleParkingTutorialHintCarId,
  getShuttleParkingTutorialProgressRatio,
  getShuttleParkingTutorialStepCarId,
  SHUTTLE_PARKING_TUTORIAL_PROGRESS_STEP_COUNT,
  type ShuttleParkingTutorialBoardState,
  type ShuttleParkingTutorialRuleId,
  shuttleParkingTutorial,
  shuttleParkingTutorialProblem,
} from "@/games/shuttle-parking/tutorial/tutorial";
import { ShuttleParkingScene } from "@/games/shuttle-parking/ui/board/ShuttleParkingScene";
import { ShuttleParkingGround } from "@/games/shuttle-parking/ui/ShuttleParkingGround";
import { ShuttleParkingHowToPlayDialog } from "@/games/shuttle-parking/ui/ShuttleParkingHowToPlayDialog";
import { ShuttleParkingStuckNotice } from "@/games/shuttle-parking/ui/ShuttleParkingStuckNotice";
import {
  completeTutorial,
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialProgress,
} from "@/games/tutorial";
import { prefersReducedMotion } from "@/lib/motion";

type ShuttleParkingTutorialProps = {
  open: boolean;
  /** ゲームのホームから開いたときに渡す。 */
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type ShuttleParkingTutorialProgress = TutorialProgress<
  ShuttleParkingTutorialRuleId,
  ShuttleParkingTutorialBoardState
>;

const goalBoard = shuttleParkingTutorial.goal();

/** 本番の盤面部品へ渡す、直前の手の知らせ。 */
function createOperation(
  board: ShuttleParkingTutorialBoardState,
  exitStartedAt: number,
): ShuttleParkingOperation | null {
  const move = board.lastMove;
  switch (move?.type) {
    case "exited":
      return {
        id: move.id,
        type: "exited",
        carId: move.carId,
        side: move.side,
        timeline: createShuttleParkingExitTimeline(
          move.before,
          move.carId,
          move.events,
        ),
        startedAt: exitStartedAt,
      };
    case "blocked": {
      const { type: _, ...block } = move;
      return { ...block, type: "blocked" };
    }
    default:
      return null;
  }
}

/**
 * チュートリアル。本番と同じ盤面の全体（列・待機枠・駐車場）で、印の車を出しながらルールを1つずつ使わせ、
 * 最後の読みの手順は印を付けずに、先頭の乗客が乗れる車を自分で選ばせる。
 * 出庫の動きを見せている間は、一言を出す前の手順のまま保ち、手を引く間は次の手を受け付けない。
 */
export function ShuttleParkingTutorial({
  open,
  playStart,
  onClose,
}: ShuttleParkingTutorialProps) {
  const [progress, setProgress] = useState<ShuttleParkingTutorialProgress>(() =>
    startTutorial(shuttleParkingTutorial),
  );
  const [progressBeforeExit, setProgressBeforeExit] =
    useState<ShuttleParkingTutorialProgress | null>(null);
  const [hintRequestedProgress, setHintRequestedProgress] =
    useState<ShuttleParkingTutorialProgress | null>(null);
  const [recall, setRecall] = useState<{
    progress: ShuttleParkingTutorialProgress;
    id: number;
  } | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const [exitStartedAt, setExitStartedAt] = useState(0);
  const situation = getTutorialSituation(shuttleParkingTutorial, progress);
  const guiding = situation.step !== null;
  const solving = progress.phase === "playing";
  const requestedHintShown = !guiding && hintRequestedProgress === progress;
  const recallId = recall?.progress === progress ? recall.id : null;
  const shownProgress = progressBeforeExit ?? progress;
  const operation = createOperation(progress.boardState, exitStartedAt);
  const lastMove = progress.boardState.lastMove;
  const lastMoveStuck = lastMove?.type === "exited" && lastMove.stuck;

  useEffect(
    () => () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    },
    [],
  );

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleExitCar(carId: ShuttleParkingCarId): void {
    const next = performTutorialAction(shuttleParkingTutorial, progress, {
      type: "exit",
      carId,
    });
    if (next === progress) return;
    const startedAt = Date.now();
    setExitStartedAt(startedAt);
    setProgress(next);
    const move = next.boardState.lastMove;
    if (move?.type === "off-step") {
      setRecall((current) => ({
        progress: next,
        id: current === null ? 0 : current.id + 1,
      }));
    }
    if (move?.type !== "exited" || prefersReducedMotion()) return;
    // 乗車と出発を見せ終えるまで、一言と進み具合を出す前の手順のまま保つ。
    setProgressBeforeExit((held) => held ?? { ...progress, violated: false });
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
    }
    const operationTimeline = createOperation(next.boardState, startedAt);
    exitTimerRef.current = window.setTimeout(
      () => setProgressBeforeExit(null),
      operationTimeline?.type === "exited"
        ? operationTimeline.timeline.durationMs
        : 0,
    );
  }

  function handleUndo(): void {
    setProgress((current) =>
      performTutorialAction(shuttleParkingTutorial, current, { type: "undo" }),
    );
  }

  function reset(): void {
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
    }
    setProgressBeforeExit(null);
    setHintRequestedProgress(null);
    setRecall(null);
    setProgress(startTutorial(shuttleParkingTutorial));
  }

  function handleRestart(): void {
    reset();
    setProgress(finishTutorialIntro);
  }

  function handleClose(): void {
    reset();
    onClose();
  }

  function handleStartPlay(): void {
    reset();
    playStart?.onStart();
  }

  const finish: TutorialFinish = playStart
    ? {
        entry: "home",
        difficulty: playStart.difficulty,
        onStartPlay: handleStartPlay,
      }
    : { entry: "play", onReturnToPlay: handleClose };

  const message = getTutorialMessage(shuttleParkingTutorial, shownProgress, {
    entry: finish.entry,
    // 1回のタップで決まる手なので、一瞬だけ違反になる途中の状態は無い。
    violationSettled: true,
  });

  const guidedExitShowing =
    progressBeforeExit !== null &&
    getTutorialSituation(shuttleParkingTutorial, progressBeforeExit).step !==
      null;
  const stepCarId = getShuttleParkingTutorialStepCarId(
    getTutorialSituation(shuttleParkingTutorial, shownProgress),
  );
  const cueCarId =
    !solving || progressBeforeExit !== null
      ? null
      : guiding
        ? stepCarId
        : requestedHintShown
          ? findShuttleParkingTutorialHintCarId(progress.boardState)
          : null;

  function renderBoard({
    scene,
    playing,
    onSceneEnd,
  }: TutorialStageBoardIntro) {
    return (
      <TutorialCrossFadeIntroScene
        scene={scene}
        playing={playing}
        onSceneEnd={onSceneEnd}
      >
        {(showsGoal) => (
          <div className="mx-auto flex size-full max-w-md flex-col px-4 pb-4">
            <ShuttleParkingScene
              problem={shuttleParkingTutorialProblem}
              state={showsGoal ? goalBoard.state : progress.boardState.state}
              operation={showsGoal ? null : operation}
              interactionDisabled={showsGoal || !solving || guidedExitShowing}
              onExitCar={handleExitCar}
              renderCarOverlay={(carId) =>
                !showsGoal && carId === cueCarId ? (
                  <TutorialCue
                    kind="pointer"
                    placement="center"
                    recallId={recallId}
                  />
                ) : null
              }
              leadingAction={
                <UndoButton
                  disabled={
                    showsGoal ||
                    !solving ||
                    !canUndoShuttleParkingTutorial(progress.boardState)
                  }
                  onUndo={handleUndo}
                />
              }
              renderLotOverlay={
                !showsGoal && solving && lastMoveStuck
                  ? () => (
                      <ShuttleParkingStuckNotice
                        canUndo={canUndoShuttleParkingTutorial(
                          progress.boardState,
                        )}
                        onUndo={handleUndo}
                        onRestart={handleRestart}
                      />
                    )
                  : undefined
              }
              clearing={!showsGoal && progress.phase === "solved"}
              onClearAnimationComplete={handleClearAnimationComplete}
            />
          </div>
        )}
      </TutorialCrossFadeIntroScene>
    );
  }

  return (
    <TutorialOverlay
      presentation="stage"
      open={open}
      title={SHUTTLE_PARKING_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      background={<ShuttleParkingGround />}
      intro={shuttleParkingTutorial.intro}
      recap={shuttleParkingTutorial.rules.map((rule) => rule.label)}
      message={message}
      phase={shownProgress.phase}
      progress={
        shownProgress.phase === "solved" || shownProgress.phase === "completed"
          ? 1
          : getShuttleParkingTutorialProgressRatio(shownProgress.boardState)
      }
      progressStepCount={SHUTTLE_PARKING_TUTORIAL_PROGRESS_STEP_COUNT}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={() => setProgress(finishTutorialIntro)}
      onRestart={handleRestart}
      renderHowToPlayDialog={(control) => (
        <ShuttleParkingHowToPlayDialog {...control} />
      )}
      onRequestHint={
        solving && !guiding && !requestedHintShown
          ? () => setHintRequestedProgress(progress)
          : null
      }
      onClose={handleClose}
    />
  );
}
