import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
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
import type { GameProgress } from "@/games/play";
import pictogramSvg from "@/games/slide-puzzle/assets/pictogram.svg?raw";
import { SLIDE_PUZZLE_DISPLAY_NAME } from "@/games/slide-puzzle/display-name";
import type { SlidePuzzleOperation } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import type {
  SlidePuzzleBoard as SlidePuzzleBoardState,
  SlidePuzzleTile,
} from "@/games/slide-puzzle/puzzle/state";
import {
  findSlidePuzzleTutorialHintTile,
  getSlidePuzzleTutorialFocusTiles,
  getSlidePuzzleTutorialProgressRatio,
  getSlidePuzzleTutorialStepTile,
  isSlidePuzzleTutorialLureShown,
  isSlidePuzzleTutorialStepCueShownUpfront,
  SLIDE_PUZZLE_TUTORIAL_PROGRESS_STEP_COUNT,
  type SlidePuzzleTutorialBoardState,
  type SlidePuzzleTutorialRuleId,
  slidePuzzleTutorial,
} from "@/games/slide-puzzle/tutorial/tutorial";
import { SlidePuzzleBoard } from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard";
import type { SlidePuzzleTileCue } from "@/games/slide-puzzle/ui/board/tile-cue";
import { SlidePuzzleGround } from "@/games/slide-puzzle/ui/SlidePuzzleGround";
import { SlidePuzzleHowToPlayDialog } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog";
import { useSlidePuzzleSoundEffects } from "@/games/slide-puzzle/ui/use-slide-puzzle-sound-effects";
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

type SlidePuzzleTutorialProps = {
  open: boolean;
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type SlidePuzzleTutorialProgress = TutorialProgress<
  SlidePuzzleTutorialRuleId,
  SlidePuzzleTutorialBoardState
>;

/** スライドしたタイルが収まるのを見届けてから、次の印を付けるまでの間。手順を終えた手では、この間は終えた手順の一言を残す。 */
const NEXT_CUE_DELAY_MS = 450;

/** 自分で探させる手順で、手が止まってから次に押すタイルに印を付けるまでの間。読みを考える間は割り込まない。 */
const SEARCH_IDLE_CUE_DELAY_MS = 4000;

const goalBoard = slidePuzzleTutorial.goal().board;

/** 本番の効果音を鳴らすための進行。解けた盤面の演出の間を完成演出として、完成の音を鳴らす。 */
const soundProgressByPhase = {
  intro: "playing",
  playing: "playing",
  solved: "clearing",
  completed: "result",
} as const satisfies Record<TutorialPhase, GameProgress>;

function createOperation(
  id: number,
  before: SlidePuzzleBoardState,
  next: SlidePuzzleTutorialProgress,
): SlidePuzzleOperation | null {
  const { lastMove, board } = next.boardState;
  switch (lastMove?.type) {
    case "rejected":
      return { id, type: "invalid", tileIndex: lastMove.cellIndex };
    case "slid":
      return {
        id,
        type: "slid",
        slide: lastMove.slide,
        boardBefore: before,
        boardAfter: board,
        isClearingMove: next.phase === "solved",
      };
    case undefined:
      return null;
  }
}

/** 0 ならすぐ付け、`null` なら手が止まっても付けない。 */
function getStepCueDelayMs(
  progress: SlidePuzzleTutorialProgress,
): number | null {
  const situation = getTutorialSituation(slidePuzzleTutorial, progress);
  if (progress.phase !== "playing" || situation.step === null) {
    return null;
  }
  if (!isSlidePuzzleTutorialStepCueShownUpfront(situation)) {
    return SEARCH_IDLE_CUE_DELAY_MS;
  }
  return progress.boardState.lastMove?.type === "slid" ? NEXT_CUE_DELAY_MS : 0;
}

/** `recallId` があれば、印の線を短く濃くして戻す。`recallId` が変わるたびにやり直す。 */
function getTileCues(
  state: SlidePuzzleTutorialBoardState,
  acknowledged: boolean,
  cueTile: SlidePuzzleTile | null,
  recallId: number | null,
  pointed: boolean,
): SlidePuzzleTileCue[] {
  const { lastMove, moveCount } = state;
  const landedCues: SlidePuzzleTileCue[] =
    acknowledged && lastMove?.type === "slid"
      ? lastMove.landedTiles.map((tile) => ({
          tile,
          kind: "landed",
          id: moveCount,
        }))
      : [];
  return cueTile === null
    ? landedCues
    : [
        // 印を付けるタイルには、印だけを重ねる。
        ...landedCues.filter((cue) => cue.tile !== cueTile),
        recallId === null
          ? { tile: cueTile, kind: "hint", id: 0, pointed }
          : { tile: cueTile, kind: "recall", id: recallId, pointed },
      ];
}

export function SlidePuzzleTutorial({
  open,
  playStart,
  onClose,
}: SlidePuzzleTutorialProps) {
  const [progress, setProgress] = useState<SlidePuzzleTutorialProgress>(() =>
    startTutorial(slidePuzzleTutorial),
  );
  const [operation, setOperation] = useState<SlidePuzzleOperation | null>(null);
  // 効果音は同じ `id` の動きで一度しか鳴らないので、最初からやり直しても前の回と重ならない `id` を振る。
  const operationIdRef = useRef(0);
  const [idleProgress, setIdleProgress] =
    useState<SlidePuzzleTutorialProgress | null>(null);
  // 手を引いている間に、手順に無いタイルを押されたら、押されるたびに次に押すタイルの印の線を短く濃くして戻す。
  const [recall, setRecall] = useState<{
    progress: SlidePuzzleTutorialProgress;
    id: number;
  } | null>(null);
  // 手を引いている間にスライドさせた手の進行。収まった合図はこの進行の間だけ見せる。
  const [acknowledgedProgress, setAcknowledgedProgress] =
    useState<SlidePuzzleTutorialProgress | null>(null);
  // 手順を終えた手の進行と、その手の前の進行。収まったタイルを見せる間は、一言も終えた手順のままにする。
  const [finishedStep, setFinishedStep] = useState<{
    progress: SlidePuzzleTutorialProgress;
    previous: SlidePuzzleTutorialProgress;
  } | null>(null);
  const [lingerEndedProgress, setLingerEndedProgress] =
    useState<SlidePuzzleTutorialProgress | null>(null);
  const [hintRequestedProgress, setHintRequestedProgress] =
    useState<SlidePuzzleTutorialProgress | null>(null);

  const situation = getTutorialSituation(slidePuzzleTutorial, progress);
  const guiding = situation.step !== null;
  const solving = progress.phase === "playing";
  const { boardState } = progress;
  const lingering =
    solving &&
    finishedStep?.progress === progress &&
    lingerEndedProgress !== progress;
  const shownProgress =
    lingering && finishedStep ? finishedStep.previous : progress;
  const shownSituation = getTutorialSituation(
    slidePuzzleTutorial,
    shownProgress,
  );
  const recallId = recall?.progress === progress ? recall.id : null;
  const cueDelayMs = getStepCueDelayMs(progress);
  const stepCueShown =
    guiding &&
    !lingering &&
    (cueDelayMs === 0 ||
      recallId !== null ||
      progress.violated ||
      (cueDelayMs !== null && idleProgress === progress));
  const requestedHintShown =
    solving && !guiding && hintRequestedProgress === progress;
  const cueTile = stepCueShown
    ? getSlidePuzzleTutorialStepTile(situation, boardState)
    : requestedHintShown
      ? findSlidePuzzleTutorialHintTile(boardState)
      : null;

  useSlidePuzzleSoundEffects(
    operation,
    soundProgressByPhase[progress.phase],
    goalBoard.length - 1,
  );

  useEffect(() => {
    if (!open || !lingering) {
      return;
    }
    const timer = window.setTimeout(
      () => setLingerEndedProgress(progress),
      NEXT_CUE_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, lingering]);

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

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  function recallCue(): void {
    if (guiding) {
      setRecall((current) => ({
        progress,
        id: current?.progress === progress ? current.id + 1 : 0,
      }));
    }
  }

  function handleSlideTile(cellIndex: number): void {
    // 終えた手順の収まったタイルを見せている間に押されたら、見せるのを終えて、その手を次の手順の手として受ける。
    if (lingering) {
      setLingerEndedProgress(progress);
    }
    const next = performTutorialAction(slidePuzzleTutorial, progress, {
      cellIndex,
    });
    if (next === progress) {
      recallCue();
      return;
    }
    if (next.stepIndex !== progress.stepIndex) {
      setFinishedStep({ progress: next, previous: progress });
    }
    setAcknowledgedProgress(guiding ? next : null);
    setProgress(next);
    operationIdRef.current += 1;
    setOperation(
      createOperation(operationIdRef.current, progress.boardState.board, next),
    );
  }

  function handleBoardAreaClick(event: ReactMouseEvent<HTMLDivElement>): void {
    if (
      solving &&
      event.target instanceof Element &&
      !event.target.closest("button")
    ) {
      recallCue();
    }
  }

  function handleRequestHint(): void {
    setHintRequestedProgress(progress);
  }

  function reset(): void {
    setAcknowledgedProgress(null);
    setFinishedStep(null);
    setLingerEndedProgress(null);
    setIdleProgress(null);
    setRecall(null);
    setHintRequestedProgress(null);
    setOperation(null);
    setProgress(startTutorial(slidePuzzleTutorial));
  }

  // ゴールはもう見せたので、入口を通さずに最初の手順から始める。
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

  /** `null` なら覆わない。タイルが動く先の空白は、盤面が抜く。 */
  function getSpotlitTiles(): SlidePuzzleTile[] | null {
    if (!solving) {
      return null;
    }
    const focusTiles = getSlidePuzzleTutorialFocusTiles(
      shownSituation,
      boardState,
    );
    if (focusTiles.length === 0) {
      return null;
    }
    const { lastMove } = boardState;
    const movedTiles =
      lastMove?.type === "slid"
        ? lingering
          ? lastMove.landedTiles
          : []
        : lastMove?.type === "rejected"
          ? [lastMove.tile]
          : [];
    return [
      ...new Set([
        ...focusTiles,
        ...movedTiles,
        ...(cueTile === null ? [] : [cueTile]),
      ]),
    ];
  }
  const spotlitTiles = getSpotlitTiles();

  /**
   * 次に押すタイルの印の線を濃くし直したときと、「ヒント」で印を出したときは、前の違反の一言を下げて、
   * 手順の一言か、残りを並べる一言に戻す。
   */
  function getMessage(): TutorialMessage {
    if (recallId !== null || requestedHintShown) {
      return situation.step?.message ?? slidePuzzleTutorial.freePlay;
    }
    return getTutorialMessage(slidePuzzleTutorial, shownProgress, {
      entry: finish.entry,
      // 1回のタップで決まる手なので、一瞬だけ違反になる途中の状態は無い。
      violationSettled: true,
    });
  }

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
          // タイルの無い所を押したときに次に押すタイルへ目を向けさせるだけで、キーで押す物は無い。
          <div
            className="aspect-square w-[min(100cqw,100cqh,28rem)]"
            onClick={handleBoardAreaClick}
          >
            <SlidePuzzleBoard
              board={showsGoal ? goalBoard : boardState.board}
              operation={showsGoal ? null : operation}
              interactionDisabled={showsGoal || !solving}
              spotlitTiles={showsGoal ? null : spotlitTiles}
              clearing={!showsGoal && progress.phase === "solved"}
              cues={
                // 完成の波を、収まった合図と重ねずに見せる。
                showsGoal || !solving
                  ? []
                  : getTileCues(
                      boardState,
                      acknowledgedProgress === progress,
                      cueTile,
                      recallId,
                      !isSlidePuzzleTutorialLureShown(situation, boardState),
                    )
              }
              onSlideTile={handleSlideTile}
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
      title={SLIDE_PUZZLE_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      background={<SlidePuzzleGround />}
      intro={slidePuzzleTutorial.intro}
      recap={slidePuzzleTutorial.rules.map((rule) => rule.label)}
      message={getMessage()}
      phase={progress.phase}
      spotlighting={spotlitTiles !== null}
      progress={
        progress.phase === "solved" || progress.phase === "completed"
          ? 1
          : getSlidePuzzleTutorialProgressRatio(
              shownProgress.stepIndex,
              boardState,
            )
      }
      progressStepCount={SLIDE_PUZZLE_TUTORIAL_PROGRESS_STEP_COUNT}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={handleRestart}
      renderHowToPlayDialog={(control) => (
        <SlidePuzzleHowToPlayDialog {...control} />
      )}
      onRequestHint={
        solving && !guiding && !lingering && !requestedHintShown
          ? handleRequestHint
          : null
      }
      onClose={handleClose}
    />
  );
}
