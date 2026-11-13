import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
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
  getSlidePuzzleTutorialStepCarriedTiles,
  getSlidePuzzleTutorialStepTile,
  type SlidePuzzleTutorialBoardState,
  type SlidePuzzleTutorialRuleId,
  type SlidePuzzleTutorialSituation,
  slidePuzzleTutorial,
} from "@/games/slide-puzzle/tutorial/tutorial";
import { SlidePuzzleBoard } from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard";
import type { SlidePuzzleTileCue } from "@/games/slide-puzzle/ui/board/tile-cue";
import { SlidePuzzleTutorialScramble } from "@/games/slide-puzzle/ui/SlidePuzzleTutorial/SlidePuzzleTutorialScramble";
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

/** スライドしたタイルが収まるのを見届けてから、次の印を付けるまでの間。 */
const NEXT_STEP_CUE_DELAY_MS = 450;

/** 手を離した後、手が止まってから次にスライドさせるタイルを示すまでの間。 */
const IDLE_HINT_DELAY_MS = 4000;

const goalBoard = slidePuzzleTutorial.goal().board;

/** 本番の効果音を鳴らすための進行。導入でゴールを見せる波は完成ではないので、解いたときだけ完成演出として鳴らす。 */
function getSoundProgress(phase: TutorialPhase): GameProgress {
  switch (phase) {
    case "intro":
    case "playing":
      return "playing";
    case "solved":
      return "clearing";
    case "completed":
      return "result";
  }
}

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
        alignedLines: [],
      };
    case undefined:
      return null;
  }
}

/**
 * 印を付けるまでの間。0 ならすぐ付け、`null` なら付けない。
 * 手を引いている間は、スライドが収まってから印を付け、スライドしなかった手の後は付けたままにする。手を離した後は手が止まったときだけ付ける。
 */
function getCueDelayMs(
  progress: SlidePuzzleTutorialProgress,
  guiding: boolean,
): number | null {
  if (progress.phase !== "playing") {
    return null;
  }
  if (!guiding) {
    return IDLE_HINT_DELAY_MS;
  }
  return progress.boardState.lastMove?.type === "slid"
    ? NEXT_STEP_CUE_DELAY_MS
    : 0;
}

function getTileCues(
  state: SlidePuzzleTutorialBoardState,
  acknowledged: boolean,
  hintTile: number | null,
  recallId: number | null,
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
  return hintTile === null
    ? landedCues
    : [
        ...landedCues.filter((cue) => cue.tile !== hintTile),
        recallId === null
          ? { tile: hintTile, kind: "hint", id: 0 }
          : { tile: hintTile, kind: "recall", id: recallId },
      ];
}

/**
 * 手を引いていなければ `null` で、覆いを出さない。
 * タイルが収まる空白は、決め手として盤面が抜く。
 */
function getSpotlitTiles(
  situation: SlidePuzzleTutorialSituation,
  state: SlidePuzzleTutorialBoardState,
  hintTile: SlidePuzzleTile | null,
): SlidePuzzleTile[] | null {
  if (situation.step === null) {
    return null;
  }
  const { lastMove } = state;
  const focused =
    hintTile !== null
      ? [hintTile, ...getSlidePuzzleTutorialStepCarriedTiles(situation, state)]
      : lastMove?.type === "slid"
        ? [...lastMove.landedTiles]
        : [];
  // ルールに当たってスライドしなかったタイルは、揺れとわけの一言が指すタイルとして抜く。
  return lastMove?.type === "rejected" ? [...focused, lastMove.tile] : focused;
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
  // 手を引いている間に、ルールに当たらない印の無いタイルを押されたら、押されるたびに印の線を短く濃くして戻す。
  // 揺れと違反の一言はルールに当たった手にだけ返すので、ここでは印へ目を向けさせるだけにする。
  const [recall, setRecall] = useState<{
    progress: SlidePuzzleTutorialProgress;
    id: number;
  } | null>(null);
  // 手を引いている間にスライドさせた手の進行と、その手の前の進行。収まった合図はこの進行の間だけ見せる。
  const [acknowledgedMove, setAcknowledgedMove] = useState<{
    progress: SlidePuzzleTutorialProgress;
    previous: SlidePuzzleTutorialProgress;
  } | null>(null);
  const situation = getTutorialSituation(slidePuzzleTutorial, progress);
  const guiding = situation.step !== null;
  const { boardState } = progress;
  const recallId = recall?.progress === progress ? recall.id : null;
  const cueDelayMs = getCueDelayMs(progress, guiding);
  const cueShown =
    cueDelayMs === 0 ||
    recallId !== null ||
    (cueDelayMs !== null && idleProgress === progress);
  // 次の印を付けるまでは、覆いから抜いた収まったタイルに合わせて、一言とルールの並びも終えた手順のまま見せる。
  const holdingFinishedStep =
    guiding && !cueShown && acknowledgedMove?.progress === progress;
  const hintTile = !cueShown
    ? null
    : guiding
      ? getSlidePuzzleTutorialStepTile(situation)
      : findSlidePuzzleTutorialHintTile(boardState);

  useSlidePuzzleSoundEffects(
    operation,
    getSoundProgress(progress.phase),
    goalBoard.length - 1,
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

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  function recallHint(): void {
    if (guiding) {
      setRecall((current) => ({
        progress,
        id: current?.progress === progress ? current.id + 1 : 0,
      }));
    }
  }

  function handleSlideTile(cellIndex: number): void {
    // 収まったタイルを見せている間は、まだ次の手順の一言も印も出していないので、手を受け付けずに次の手順を見せる。
    if (holdingFinishedStep) {
      setIdleProgress(progress);
      return;
    }
    const next = performTutorialAction(slidePuzzleTutorial, progress, {
      cellIndex,
    });
    if (next === progress) {
      recallHint();
      return;
    }
    // 収まった合図は本番に無いので、手を引いている間の手にだけ返す。
    if (guiding) {
      setAcknowledgedMove({ progress: next, previous: progress });
    }
    setProgress(next);
    operationIdRef.current += 1;
    setOperation(
      createOperation(operationIdRef.current, progress.boardState.board, next),
    );
  }

  function handleBoardAreaClick(event: ReactMouseEvent<HTMLDivElement>): void {
    if (
      progress.phase === "playing" &&
      event.target instanceof Element &&
      !event.target.closest("button")
    ) {
      recallHint();
    }
  }

  function restart(): void {
    setAcknowledgedMove(null);
    setIdleProgress(null);
    setRecall(null);
    setOperation(null);
    setProgress(startTutorial(slidePuzzleTutorial));
  }

  function handleClose(): void {
    restart();
    onClose();
  }

  function handleStartPlay(): void {
    restart();
    playStart?.onStart();
  }

  function getMessage(): TutorialMessage {
    // 印の線を濃くし直したときと、手を離した後に止まって印が出たときは、前の違反の一言を下げて、
    // 印のタイルへ向かう手順の一言か、残りを収める一言に戻す。
    if (recallId !== null || (!guiding && hintTile !== null)) {
      return situation.step?.message ?? slidePuzzleTutorial.freePlay;
    }
    return getTutorialMessage(slidePuzzleTutorial, shownProgress, {
      entry: finish.entry,
      // 1回のタップで決まる手なので、一瞬だけ違反になる途中の状態は無い。
      violationSettled: true,
    });
  }

  const shownProgress = holdingFinishedStep
    ? (acknowledgedMove?.previous ?? progress)
    : progress;
  const shownSituation = getTutorialSituation(
    slidePuzzleTutorial,
    shownProgress,
  );

  const finish: TutorialFinish = playStart
    ? {
        entry: "home",
        difficulty: playStart.difficulty,
        onStartPlay: handleStartPlay,
      }
    : { entry: "play", onReturnToPlay: handleClose };

  function renderBoard({ scene, playing, onSceneEnd }: TutorialBoardIntro) {
    return (
      // タイルの無い所を押したときに印へ目を向けさせるだけで、キーで押す物は無い。
      <div
        className="aspect-square w-[min(100cqw,100cqh,28rem)]"
        onClick={handleBoardAreaClick}
      >
        <SlidePuzzleTutorialScramble
          active={scene === "start" && playing}
          onComplete={onSceneEnd}
        >
          {(frame) => (
            <SlidePuzzleBoard
              board={
                frame?.board ??
                (scene === "goal" ? goalBoard : boardState.board)
              }
              operation={
                frame ? frame.operation : scene === null ? operation : null
              }
              interactionDisabled={progress.phase !== "playing"}
              spotlitTiles={
                progress.phase === "playing" && scene === null
                  ? getSpotlitTiles(situation, boardState, hintTile)
                  : null
              }
              clearing={
                progress.phase === "solved" || (scene === "goal" && playing)
              }
              cues={
                // 完成の波を、収まった合図と重ねずに見せる。
                progress.phase === "playing"
                  ? getTileCues(
                      boardState,
                      acknowledgedMove?.progress === progress,
                      hintTile,
                      recallId,
                    )
                  : []
              }
              onSlideTile={handleSlideTile}
              onClearAnimationComplete={
                scene === "goal" ? onSceneEnd : handleClearAnimationComplete
              }
            />
          )}
        </SlidePuzzleTutorialScramble>
      </div>
    );
  }

  return (
    <TutorialOverlay
      open={open}
      title={SLIDE_PUZZLE_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      intro={slidePuzzleTutorial.intro}
      rules={slidePuzzleTutorial.rules.map((rule) => ({
        ...rule,
        earned: shownProgress.earnedRuleIds.includes(rule.id),
        current: shownSituation.step?.introducedRuleId === rule.id,
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
