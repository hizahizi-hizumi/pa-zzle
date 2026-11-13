import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { TutorialCrossFadeIntroScene } from "@/components/TutorialCrossFadeIntroScene";
import {
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
  type TutorialStageBoardIntro,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/ice-floor-maze/assets/pictogram.svg?raw";
import { ICE_FLOOR_MAZE_DISPLAY_NAME } from "@/games/ice-floor-maze/display-name";
import {
  createIceFloorMazeLastSlide,
  type IceFloorMazeBlockedInput,
  type IceFloorMazeLastSlide,
} from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import {
  getIceFloorMazeNeighbor,
  type IceFloorMazeDirection,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import {
  findIceFloorMazeTutorialHint,
  getIceFloorMazeTutorialStepFocus,
  ICE_FLOOR_MAZE_TUTORIAL_PROGRESS_STEP_COUNT,
  type IceFloorMazeTutorialBoardState,
  type IceFloorMazeTutorialFocus,
  type IceFloorMazeTutorialMove,
  type IceFloorMazeTutorialRuleId,
  iceFloorMazeTutorial,
  iceFloorMazeTutorialPuzzle,
  iceFloorMazeTutorialRecap,
  listIceFloorMazeTutorialMoveCellIndices,
} from "@/games/ice-floor-maze/tutorial/tutorial";
import type { IceFloorMazeCellCue } from "@/games/ice-floor-maze/ui/board/cell-cue";
import { IceFloorMazeBoard } from "@/games/ice-floor-maze/ui/board/IceFloorMazeBoard";
import { getIceFloorMazeSlideDurationMs } from "@/games/ice-floor-maze/ui/board/slide-timing";
import { IceFloorMazeGround } from "@/games/ice-floor-maze/ui/IceFloorMazeGround";
import { IceFloorMazeHowToPlayDialog } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog";
import { IceFloorMazeSwipeArea } from "@/games/ice-floor-maze/ui/IceFloorMazeSwipeArea";
import { useIceFloorMazeSoundEffects } from "@/games/ice-floor-maze/ui/use-ice-floor-maze-sound-effects";
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
import { prefersReducedMotion } from "@/lib/motion";

type IceFloorMazeTutorialProps = {
  open: boolean;
  /** ゲームのホームから開いたときに渡す。渡さなければプレイ中のメニューから開いたとする。 */
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type IceFloorMazeTutorialProgress = TutorialProgress<
  IceFloorMazeTutorialRuleId,
  IceFloorMazeTutorialBoardState
>;

// 駒の通ったマスと止まる位置を決めた物を、その手順の一言と一緒に残して見届けさせてから、次の一言と印に替える。
// この間に次の手が来たら、見届けたとみなしてすぐ次の印に替え、その手を受け付ける。
const GUIDED_SLIDE_SETTLE_MS = 900;

const { board, goal } = iceFloorMazeTutorialPuzzle;
const goalBoardState = iceFloorMazeTutorial.goal();

const directionByArrowKey: Readonly<Record<string, IceFloorMazeDirection>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/** 解けた盤面の演出の間が、本番の完成演出の間に当たる。 */
const soundProgressByPhase = {
  intro: "playing",
  playing: "playing",
  solved: "clearing",
  completed: "result",
} as const satisfies Record<TutorialPhase, GameProgress>;

/** 盤面は滑りの間の動きを自分で描くので、チュートリアルは滑っている間を待たない。 */
function ignoreSlideAnimationActivity(): void {}

function getSlideAnimationMs({ slide }: IceFloorMazeTutorialMove): number {
  return prefersReducedMotion()
    ? 0
    : getIceFloorMazeSlideDurationMs(slide.path.length);
}

function getGuidedSettleDelayMs(
  progress: IceFloorMazeTutorialProgress,
): number | null {
  const { lastMove } = progress.boardState;
  return progress.phase === "playing" && lastMove?.guided
    ? getSlideAnimationMs(lastMove) + GUIDED_SLIDE_SETTLE_MS
    : null;
}

export function IceFloorMazeTutorial({
  open,
  playStart,
  onClose,
}: IceFloorMazeTutorialProps) {
  const [progress, setProgress] = useState<IceFloorMazeTutorialProgress>(() =>
    startTutorial(iceFloorMazeTutorial),
  );
  // 手を引いている間に滑らせた手の進行と、その手の前の進行。滑りを見届ける間は、一言を滑らせる前の手順のままにする。
  const [guidedMove, setGuidedMove] = useState<{
    progress: IceFloorMazeTutorialProgress;
    previous: IceFloorMazeTutorialProgress;
  } | null>(null);
  const [settledProgress, setSettledProgress] =
    useState<IceFloorMazeTutorialProgress | null>(null);
  const [hintRequestedProgress, setHintRequestedProgress] =
    useState<IceFloorMazeTutorialProgress | null>(null);
  const [recall, setRecall] = useState<{
    progress: IceFloorMazeTutorialProgress;
    id: number;
  } | null>(null);
  // 本番の盤面と効果音は、入力ごとに変わる `id` の付いた直前の滑りと動けなかった入力で動く。
  const [lastSlide, setLastSlide] = useState<IceFloorMazeLastSlide | null>(
    null,
  );
  const [blockedInput, setBlockedInput] =
    useState<IceFloorMazeBlockedInput | null>(null);
  // 効果音は同じ `id` の入力で一度しか鳴らないので、最初からやり直しても前の回と重ならない `id` を振る。
  const inputIdRef = useRef(0);
  // 手を引いている間に最後に滑らせた時刻。駒が滑っている間の入力は受け付けない。
  const guidedMovedAtRef = useRef(0);
  const situation = getTutorialSituation(iceFloorMazeTutorial, progress);
  const guiding = situation.step !== null;
  const playing = progress.phase === "playing";
  const { boardState } = progress;
  const recallId = recall?.progress === progress ? recall.id : null;
  const settleDelayMs = getGuidedSettleDelayMs(progress);
  // 手を引いている間に滑らせてから見届けるまでは、滑らせる前の手順の一言を残す。
  const settling = settleDelayMs !== null && settledProgress !== progress;
  const shownProgress =
    settling && guidedMove?.progress === progress
      ? guidedMove.previous
      : progress;
  const shownSituation = getTutorialSituation(
    iceFloorMazeTutorial,
    shownProgress,
  );
  // 手を離した後は、自分で解いている間に割り込まないよう、手がかりは「ヒント」を押されたときだけ見せ、次の手で消す。
  const hint =
    playing && !guiding && !settling && hintRequestedProgress === progress
      ? findIceFloorMazeTutorialHint(boardState)
      : null;
  const focus: IceFloorMazeTutorialFocus | null = settling
    ? null
    : guiding
      ? getIceFloorMazeTutorialStepFocus(situation, boardState)
      : hint;
  // スワイプの操作は、操作を教える手順でだけ指で見せる。ほかの手順と手がかりで向きを見せると、止めたいマスへの向きを自分で読まずに済んでしまう。
  const swipe =
    focus !== null && situation.step === iceFloorMazeTutorial.steps[0]
      ? {
          cellIndex: focus.nextSlide.from,
          direction: focus.nextSlide.direction,
        }
      : null;
  const cue: IceFloorMazeCellCue | null =
    focus === null ? null : { cellIndex: focus.target, recallId, swipe };
  // 操作を教える手順には、手を決める物を見せる読みが無いので、盤面を覆わない。
  const teachesOperation =
    shownSituation.step === iceFloorMazeTutorial.steps[0];
  const spotlitCells =
    !playing || teachesOperation
      ? []
      : settling && boardState.lastMove
        ? listIceFloorMazeTutorialMoveCellIndices(boardState.lastMove)
        : (focus?.cellIndices ?? []);

  useIceFloorMazeSoundEffects(
    lastSlide,
    blockedInput,
    goal,
    soundProgressByPhase[progress.phase],
  );

  useEffect(() => {
    if (!open || settleDelayMs === null) {
      return;
    }
    const timer = window.setTimeout(
      () => setSettledProgress(progress),
      settleDelayMs,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, settleDelayMs]);

  const handleArrowKey = useEffectEvent((event: KeyboardEvent) => {
    const direction = directionByArrowKey[event.key];
    if (
      !direction ||
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    // 押し続けたときの繰り返しは、止まった後に同じ向きへ押し戻しを重ねるだけなので滑らせない。
    if (!event.repeat) {
      slide(direction);
    }
  });

  // 本番と同じく矢印キーでも滑らせる。チュートリアルは画面全体を覆うので、開いて解いている間はどこにフォーカスがあっても受ける。
  useEffect(() => {
    if (!open || !playing) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent): void {
      handleArrowKey(event);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, playing]);

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  function nextInputId(): number {
    inputIdRef.current += 1;
    return inputIdRef.current;
  }

  function slide(direction: IceFloorMazeDirection): void {
    if (!playing) {
      return;
    }
    if (settling && boardState.lastMove) {
      // 駒が滑っている間は、次の一言と印を出す前の手を通さない。滑り終えた後の手は、見届けたとみなして受け付ける。
      if (
        Date.now() - guidedMovedAtRef.current <
        getSlideAnimationMs(boardState.lastMove)
      ) {
        return;
      }
      setSettledProgress(progress);
    }
    const next = performTutorialAction(iceFloorMazeTutorial, progress, {
      direction,
    });
    if (next === progress) {
      if (guiding) {
        setRecall((current) => ({
          progress,
          id: current?.progress === progress ? current.id + 1 : 0,
        }));
      }
      const from = boardState.puzzleState.position;
      // 1マスも動けない向きは、手を引いている間も本番と同じく押し戻す。滑れる向きは、印の線を濃くし直すだけにする。
      if (
        slideIceFloorMazePiece(board, boardState.puzzleState, direction)
          .status === "blocked"
      ) {
        setBlockedInput({
          id: nextInputId(),
          direction,
          from,
          stopper: getIceFloorMazeNeighbor(board, from, direction),
        });
      }
      return;
    }
    const move = next.boardState.lastMove;
    if (move?.guided) {
      guidedMovedAtRef.current = Date.now();
      setGuidedMove({ progress: next, previous: progress });
    }
    setProgress(next);
    setBlockedInput(null);
    setLastSlide(
      move
        ? createIceFloorMazeLastSlide({
            id: nextInputId(),
            board,
            goal,
            slide: move.slide,
            isClearingMove: next.phase === "solved",
            // どう滑ってもゴールに止まれなくなる所の無い盤面なので、もう止まれないことを知らせる場面は無い。
            entersTrap: false,
          })
        : null,
    );
  }

  function restart(): void {
    setGuidedMove(null);
    setSettledProgress(null);
    setHintRequestedProgress(null);
    setRecall(null);
    setLastSlide(null);
    setBlockedInput(null);
    setProgress(startTutorial(iceFloorMazeTutorial));
  }

  // ゴールはもう見せたので、入口を通さずに最初の手順から始める。
  function handleRestart(): void {
    restart();
    setProgress(finishTutorialIntro);
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

  const message: TutorialMessage =
    hint !== null
      ? hint.message
      : getTutorialMessage(iceFloorMazeTutorial, shownProgress, {
          entry: finish.entry,
          // どの滑りもルールに合うので、違反の一言は出ない。
          violationSettled: true,
        });

  function renderBoard({
    scene,
    playing: scenePlaying,
    onSceneEnd,
  }: TutorialStageBoardIntro) {
    const solving = playing && scene === null;
    return (
      <div className="flex h-[100cqh] w-[100cqw] flex-col">
        <IceFloorMazeSwipeArea disabled={!solving} onSwipe={slide}>
          <TutorialCrossFadeIntroScene
            scene={scene}
            playing={scenePlaying}
            onSceneEnd={onSceneEnd}
          >
            {(showsGoal) => {
              const { puzzleState } = showsGoal ? goalBoardState : boardState;
              return (
                <IceFloorMazeBoard
                  board={board}
                  cells={puzzleState.cells}
                  blocks={puzzleState.blocks}
                  goal={goal}
                  position={puzzleState.position}
                  lastSlide={showsGoal ? null : lastSlide}
                  blockedInput={showsGoal ? null : blockedInput}
                  clearing={!showsGoal && progress.phase === "solved"}
                  cue={solving ? cue : null}
                  spotlitCells={solving ? spotlitCells : []}
                  onSlideAnimationActivityChange={ignoreSlideAnimationActivity}
                  onClearAnimationComplete={handleClearAnimationComplete}
                />
              );
            }}
          </TutorialCrossFadeIntroScene>
        </IceFloorMazeSwipeArea>
      </div>
    );
  }

  return (
    <TutorialOverlay
      presentation="stage"
      open={open}
      title={ICE_FLOOR_MAZE_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      background={<IceFloorMazeGround />}
      intro={iceFloorMazeTutorial.intro}
      recap={iceFloorMazeTutorialRecap}
      message={message}
      phase={progress.phase}
      spotlighting={playing && spotlitCells.length > 0}
      progress={
        progress.phase === "solved" || progress.phase === "completed"
          ? 1
          : shownProgress.stepIndex /
            ICE_FLOOR_MAZE_TUTORIAL_PROGRESS_STEP_COUNT
      }
      progressStepCount={ICE_FLOOR_MAZE_TUTORIAL_PROGRESS_STEP_COUNT}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={handleRestart}
      renderHowToPlayDialog={(control) => (
        <IceFloorMazeHowToPlayDialog {...control} />
      )}
      onRequestHint={
        playing && !guiding && !settling && hint === null
          ? () => setHintRequestedProgress(progress)
          : null
      }
      onClose={handleClose}
    />
  );
}
