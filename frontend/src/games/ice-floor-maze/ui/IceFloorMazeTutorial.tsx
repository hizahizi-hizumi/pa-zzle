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
import pictogramSvg from "@/games/ice-floor-maze/assets/pictogram.svg?raw";
import { ICE_FLOOR_MAZE_DISPLAY_NAME } from "@/games/ice-floor-maze/display-name";
import type {
  IceFloorMazeBlockedInput,
  IceFloorMazeLastSlide,
} from "@/games/ice-floor-maze/play/use-ice-floor-maze-play";
import {
  doesIceFloorMazeSlidePassGoal,
  getIceFloorMazeNeighbor,
  type IceFloorMazeDirection,
} from "@/games/ice-floor-maze/puzzle/rules";
import {
  findIceFloorMazeTutorialHintCellIndex,
  getIceFloorMazeTutorialStepFocus,
  type IceFloorMazeTutorialBoardState,
  type IceFloorMazeTutorialMove,
  type IceFloorMazeTutorialRuleId,
  type IceFloorMazeTutorialSituation,
  iceFloorMazeTutorial,
  iceFloorMazeTutorialPuzzle,
  listIceFloorMazeTutorialMoveCellIndices,
} from "@/games/ice-floor-maze/tutorial/tutorial";
import type { IceFloorMazeCellCue } from "@/games/ice-floor-maze/ui/board/cell-cue";
import { IceFloorMazeBoard } from "@/games/ice-floor-maze/ui/board/IceFloorMazeBoard";
import { getIceFloorMazeSlideDurationMs } from "@/games/ice-floor-maze/ui/board/slide-timing";
import { IceFloorMazeSwipeArea } from "@/games/ice-floor-maze/ui/IceFloorMazeSwipeArea";
import { IceFloorMazeTutorialRewind } from "@/games/ice-floor-maze/ui/IceFloorMazeTutorial/IceFloorMazeTutorialRewind";
import { useIceFloorMazeSoundEffects } from "@/games/ice-floor-maze/ui/use-ice-floor-maze-sound-effects";
import type { GameProgress } from "@/games/play";
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
import { cn } from "@/lib/utils";

type IceFloorMazeTutorialProps = {
  open: boolean;
  /** ゲームのホームから開いたときに渡す。終えたときに、ゲームのホームで開いているレベルを始める操作を出す。渡さなければプレイ中に開いたとして、閉じてプレイに戻る操作を出す。 */
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type IceFloorMazeTutorialProgress = TutorialProgress<
  IceFloorMazeTutorialRuleId,
  IceFloorMazeTutorialBoardState
>;

/**
 * 手順どおりに滑らせてから次の手順へ替えるまでの、滑り終えてからの間。崩れる・割れる・押し出す動きを、
 * 今の手順の一言と、駒の通ったマスと決め手を残したまま見届けさせてから、次の一言と印とその決め手に替える。
 */
const NEXT_STEP_SETTLE_MS = 900;

/** 手を離した後、手が止まってから次に止まるマスを示すまでの間。 */
const IDLE_HINT_DELAY_MS = 4000;

const { board, goal } = iceFloorMazeTutorialPuzzle;
const goalBoardState = iceFloorMazeTutorial.goal();

const directionByArrowKey: Readonly<Record<string, IceFloorMazeDirection>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/** 本番と同じ効果音を、本番のプレイの進行に当てはめて鳴らす。導入でゴールを見せる演出は完成ではないので、解いたときだけ完成の音を鳴らす。 */
const soundProgressByPhase = {
  intro: "playing",
  playing: "playing",
  solved: "clearing",
  completed: "result",
} as const satisfies Record<TutorialPhase, GameProgress>;

/** 盤面は滑りの間の動きを自分で描くので、チュートリアルは滑っている間を待たない。 */
function ignoreSlideAnimationActivity(): void {}

/**
 * 手順どおりに滑らせてから、次の手順の一言と印に替えるまでの間。直前の手が手順の手でなければ `null`。
 * 手順の手のほかに手を打てないので、盤面が変わった手の数が手順の数以下なら、直前の手は手順の手。
 */
function getStepSettleDelayMs(
  progress: IceFloorMazeTutorialProgress,
): number | null {
  const { lastMove, moveCount } = progress.boardState;
  return progress.phase === "playing" &&
    lastMove &&
    moveCount <= iceFloorMazeTutorial.steps.length
    ? getIceFloorMazeSlideDurationMs(lastMove.slide.path.length) +
        NEXT_STEP_SETTLE_MS
    : null;
}

function createLastSlide(
  id: number,
  { slide }: IceFloorMazeTutorialMove,
  cleared: boolean,
): IceFloorMazeLastSlide {
  return {
    id,
    direction: slide.direction,
    from: slide.from,
    to: slide.to,
    path: slide.path,
    crumbledRock: slide.crumbledRock,
    crackedIce: slide.crackedIce,
    pushedSnow: slide.pushedSnow,
    movedBlock: slide.movedBlock,
    stoppedOnFloor: board.cells[slide.to] === "floor",
    passedGoal: doesIceFloorMazeSlidePassGoal(slide, goal),
    isClearingMove: cleared,
    // 手を離した後もどう滑っても詰まない盤面なので、もう止まれないことを知らせる場面は無い。
    entersTrap: false,
  };
}

/**
 * 手を引いている間に、画面全体の覆いから抜くマス。手を引いていなければ空で、覆いは出ない。
 * - 手順どおりに滑らせてから次の手順に替えるまでの間は、駒が通ったマスと、その滑りの決め手と、動いた雪・塊の行き先。
 * - 手順の間は、駒のいるマスから印のマスまでの通り道と、そこへ止まる滑りの決め手。
 */
function getSpotlitCells(
  situation: IceFloorMazeTutorialSituation,
  state: IceFloorMazeTutorialBoardState,
  settling: boolean,
): number[] {
  if (settling) {
    return state.lastMove
      ? listIceFloorMazeTutorialMoveCellIndices(state.lastMove)
      : [];
  }
  const focus = getIceFloorMazeTutorialStepFocus(situation, state);
  return focus
    ? [state.puzzleState.position, ...focus.path, ...focus.reasonCellIndices]
    : [];
}

/**
 * 6×6 の盤面を、一言と印に沿って1回ずつ滑らせ、止め役と要素のルールを1つずつ使って身につけさせる。
 * 手順を終えたら手を離し、残りを自分でゴールに止めさせる。盤面・滑りと要素の動き・効果音・完成演出は本番と同じものを使う。
 */
export function IceFloorMazeTutorial({
  open,
  playStart,
  onClose,
}: IceFloorMazeTutorialProps) {
  const [progress, setProgress] = useState<IceFloorMazeTutorialProgress>(() =>
    startTutorial(iceFloorMazeTutorial),
  );
  const [idleProgress, setIdleProgress] =
    useState<IceFloorMazeTutorialProgress | null>(null);
  const [settledProgress, setSettledProgress] =
    useState<IceFloorMazeTutorialProgress | null>(null);
  // 手を引いている間に印のマスで止まらない向きへ滑らせようとされたら、そのたびに印の線を短く濃くして戻す。
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
  const situation = getTutorialSituation(iceFloorMazeTutorial, progress);
  const guiding = situation.step !== null;
  const playing = progress.phase === "playing";
  const { boardState } = progress;
  const recallId = recall?.progress === progress ? recall.id : null;
  const settleDelayMs = getStepSettleDelayMs(progress);
  // 手順どおりに滑らせてから見届けるまでは、今滑らせた手順の一言とルールを残し、次の手は受け付けない。
  const settling = settleDelayMs !== null && settledProgress !== progress;
  const shownStepIndex = settling ? progress.stepIndex - 1 : progress.stepIndex;
  const shownStep = iceFloorMazeTutorial.steps[shownStepIndex] ?? null;
  const shownRuleIds = iceFloorMazeTutorial.steps
    .slice(0, shownStepIndex + 1)
    .map(({ introducedRuleId }) => introducedRuleId);
  const idleHintShown =
    playing && !guiding && !settling && idleProgress === progress;
  const cueCellIndex = settling
    ? null
    : (situation.step?.target ??
      (idleHintShown
        ? findIceFloorMazeTutorialHintCellIndex(boardState)
        : null));
  const cue: IceFloorMazeCellCue | null =
    cueCellIndex === null ? null : { cellIndex: cueCellIndex, recallId };

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

  useEffect(() => {
    // 止まったとみなす間は、手を離す一言が出てから数える。
    if (!open || !playing || guiding || settling) {
      return;
    }
    const timer = window.setTimeout(
      () => setIdleProgress(progress),
      IDLE_HINT_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, playing, guiding, settling, progress]);

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
    // 次の手順の一言と印を出す前に、その手順のルールを使う手を通さない。
    if (!playing || settling) {
      return;
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
        return;
      }
      // 手を離した後に盤面が変わらないのは、すぐ隣が止め役で1マスも動けない向きだけ。本番と同じく押し戻す。
      const from = boardState.puzzleState.position;
      setBlockedInput({
        id: nextInputId(),
        direction,
        from,
        stopper: getIceFloorMazeNeighbor(board, from, direction),
      });
      return;
    }
    const move = next.boardState.lastMove;
    setProgress(next);
    setBlockedInput(null);
    setLastSlide(
      move
        ? createLastSlide(nextInputId(), move, next.phase === "solved")
        : null,
    );
  }

  function restart(): void {
    setIdleProgress(null);
    setSettledProgress(null);
    setRecall(null);
    setLastSlide(null);
    setBlockedInput(null);
    setProgress(startTutorial(iceFloorMazeTutorial));
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
   * 導入では解き終えた盤面を見せ、始めの盤面の場面では、解き終えた盤面を消してから始めの盤面を出す。
   * 最初の手順の印は、導入の終わりに一言と同時に出す。盤面の領域のどこでもスワイプを受ける。
   */
  function renderBoard({
    scene,
    playing: scenePlaying,
    onSceneEnd,
    messageShown,
  }: TutorialBoardIntro) {
    const goalShown = scene === "goal" || (scene === "start" && scenePlaying);
    const { puzzleState } = goalShown ? goalBoardState : boardState;
    const solving = playing && scene === null;
    const cueShown =
      solving || (progress.phase === "intro" && scene === null && messageShown);
    return (
      <div className="flex h-[100cqh] w-[100cqw] flex-col">
        <IceFloorMazeSwipeArea disabled={!solving} onSwipe={slide}>
          <IceFloorMazeTutorialRewind
            active={scene === "start" && scenePlaying}
            onComplete={onSceneEnd}
          >
            <div
              className={cn(
                "size-full",
                scene === "start" &&
                  !scenePlaying &&
                  "animate-in fade-in-0 duration-(--duration-normal) ease-(--ease-enter) motion-reduce:animate-none",
              )}
            >
              <IceFloorMazeBoard
                board={board}
                cells={puzzleState.cells}
                blocks={puzzleState.blocks}
                goal={goal}
                position={puzzleState.position}
                lastSlide={scene === null ? lastSlide : null}
                blockedInput={scene === null ? blockedInput : null}
                clearing={
                  progress.phase === "solved" ||
                  (scene === "goal" && scenePlaying)
                }
                cue={cueShown ? cue : null}
                spotlitCells={
                  solving && shownStep !== null
                    ? getSpotlitCells(situation, boardState, settling)
                    : []
                }
                onSlideAnimationActivityChange={ignoreSlideAnimationActivity}
                onClearAnimationComplete={
                  scene === "goal" ? onSceneEnd : handleClearAnimationComplete
                }
              />
            </div>
          </IceFloorMazeTutorialRewind>
        </IceFloorMazeSwipeArea>
      </div>
    );
  }

  return (
    <TutorialOverlay
      open={open}
      title={ICE_FLOOR_MAZE_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      intro={iceFloorMazeTutorial.intro}
      rules={iceFloorMazeTutorial.rules.map((rule) => ({
        ...rule,
        earned: shownRuleIds.includes(rule.id),
        current: shownStep?.introducedRuleId === rule.id,
      }))}
      message={
        // 手を離した後に止まって手がかりの印を出しても、一言は足さない。
        settling && shownStep
          ? shownStep.message
          : getTutorialMessage(iceFloorMazeTutorial, progress, {
              entry: finish.entry,
              // どの滑りもルールに合うので、違反の一言は出ない。
              violationSettled: true,
            })
      }
      phase={progress.phase}
      guiding={playing && shownStep !== null}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={restart}
      onClose={handleClose}
    />
  );
}
