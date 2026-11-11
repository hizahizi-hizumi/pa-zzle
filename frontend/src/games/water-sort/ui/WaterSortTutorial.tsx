import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { TutorialCrossFadeIntroScene } from "@/components/TutorialCrossFadeIntroScene";
import type {
  TutorialFinish,
  TutorialPlayStart,
} from "@/components/TutorialOverlay";
import {
  TutorialStage,
  type TutorialStageBoardIntro,
} from "@/components/TutorialStage";
import type { GameProgress } from "@/games/play";
import {
  completeTutorial,
  finishTutorialIntro,
  getTutorialMessage,
  getTutorialSituation,
  performTutorialAction,
  startTutorial,
  type TutorialMessage,
  type TutorialProgress,
} from "@/games/tutorial";
import pictogramSvg from "@/games/water-sort/assets/pictogram.svg?raw";
import { WATER_SORT_DISPLAY_NAME } from "@/games/water-sort/display-name";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import {
  describeWaterSortTutorialFreePlay,
  describeWaterSortTutorialStep,
  findWaterSortTutorialHintBottleIndex,
  getWaterSortTutorialProgressRatio,
  getWaterSortTutorialStepBottleIndex,
  listWaterSortTutorialCompletedBottleIndices,
  WATER_SORT_TUTORIAL_PROGRESS_STEP_COUNT,
  type WaterSortTutorialBoardState,
  type WaterSortTutorialRuleId,
  waterSortTutorial,
} from "@/games/water-sort/tutorial/tutorial";
import type { WaterSortBottleCue } from "@/games/water-sort/ui/board/bottle-cue";
import {
  WATER_SORT_SINGLE_ROW_GAP_PX,
  WaterSortBoard,
} from "@/games/water-sort/ui/board/WaterSortBoard";
import { useWaterSortSoundEffects } from "@/games/water-sort/ui/use-water-sort-sound-effects";
import { WaterSortBackground } from "@/games/water-sort/ui/WaterSortBackground";
import { prefersReducedMotion } from "@/lib/motion";

type WaterSortTutorialProps = {
  open: boolean;
  /** ゲームのホームから開いたときに渡す。終えたときに、ゲームのホームで開いているレベルを始める操作を出す。渡さなければプレイ中に開いたとして、閉じてプレイに戻る操作を出す。 */
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type WaterSortTutorialProgress = TutorialProgress<
  WaterSortTutorialRuleId,
  WaterSortTutorialBoardState
>;

/** 手を離した後、手が止まってから次にタップするボトルを示すまでの間。 */
const IDLE_HINT_DELAY_MS = 4000;

const goalBottles = waterSortTutorial.goal().bottles;

/** 1段に並べるボトルの数と、ボトルの間の合計。 */
const BOTTLE_COUNT = waterSortTutorial.start().bottles.length;
const BOTTLE_GAPS = `${WATER_SORT_SINGLE_ROW_GAP_PX * (BOTTLE_COUNT - 1)}px`;

/**
 * 盤面を1段に並べ、本番と同じく画面の幅いっぱいに大きく見せる。
 * 注ぐボトルは注ぎ先の口の上（ボトルの高さの0.55倍上）へ移って傾き、口から上へボトルの幅の約2倍まで届くので、
 * ボトルの幅を `--bottle` とし、上に2.1倍の余白を取って、注ぐ動きと選んだボトルの持ち上げを上の見出しにかけない。
 * ボトルの高さは幅の 1/0.36 倍（約2.78倍）。
 */
const boardFrameStyle = {
  "--bottle": `min(calc((100cqw - ${BOTTLE_GAPS}) / ${BOTTLE_COUNT}), calc(100cqh / 4.9), 6rem)`,
  width: `calc(var(--bottle) * ${BOTTLE_COUNT} + ${BOTTLE_GAPS})`,
  boxSizing: "content-box",
  paddingTop: "calc(var(--bottle) * 2.1)",
} as CSSProperties;

/** 本番の盤面と同じく、注ぐ動きを見せられるか。見せられないときは、注いだ結果をすぐ見せる。 */
function canAnimatePour(): boolean {
  return (
    typeof HTMLElement.prototype.animate === "function" &&
    !prefersReducedMotion()
  );
}

/** 本番の効果音のフックへ渡す、プレイの進行。解けた盤面の演出の間を完成演出として、完成の音を鳴らす。 */
const gameProgressByPhase = {
  intro: "playing",
  playing: "playing",
  solved: "clearing",
  completed: "result",
} as const satisfies Record<WaterSortTutorialProgress["phase"], GameProgress>;

/**
 * 手の結果を、盤面の選択・注ぐ動き・揺れにする。
 * `id` は、もう一度始めても本番の効果音が同じ知らせとみなさないよう、開いている間ずっと増やす。
 */
function createOperation(
  next: WaterSortTutorialProgress,
  id: number,
): WaterSortOperation | null {
  const { lastMove, bottles } = next.boardState;
  switch (lastMove?.type) {
    case "selected":
      return {
        id,
        type: "source-selected",
        bottleIndex: lastMove.bottleIndex,
      };
    case "deselected":
      return {
        id,
        type: "source-deselected",
        bottleIndex: lastMove.bottleIndex,
      };
    case "rejected":
      return {
        id,
        type: "invalid",
        bottleIndex: lastMove.bottleIndex,
      };
    case "poured":
      return {
        id,
        type: "poured",
        sourceBottleIndex: lastMove.move.sourceBottleIndex,
        destinationBottleIndex: lastMove.move.destinationBottleIndex,
        stateBefore: lastMove.stateBefore,
        stateAfter: bottles,
        isClearingMove: next.phase === "solved",
      };
    case undefined:
      return null;
  }
}

/**
 * ボトルに重ねる合図。1色そろったボトルの印と、次にタップするボトルの印。
 * `recallId` があれば、次にタップするボトルの印の線を短く濃くして戻し、指を出し直す。
 */
function getBottleCues(
  completedBottleIndices: readonly number[],
  hintBottleIndex: number | null,
  recallId: number | null,
): WaterSortBottleCue[] {
  return [
    ...completedBottleIndices.map(
      (bottleIndex) => ({ bottleIndex, kind: "completed", id: 0 }) as const,
    ),
    ...(hintBottleIndex === null
      ? []
      : [
          recallId === null
            ? ({ bottleIndex: hintBottleIndex, kind: "hint", id: 0 } as const)
            : ({
                bottleIndex: hintBottleIndex,
                kind: "recall",
                id: recallId,
              } as const),
        ]),
  ];
}

/**
 * プレイ画面と同じ地の上で、3色の盤面を、一言と指さしに沿って3手注ぎ、操作とルールを1つずつ使って身につけさせる。
 * 手順を終えたら手を離し、残りを自分でそろえさせる。盤面・注ぐ動き・最後に注いでそろう動きは本番と同じ部品を使う。
 */
export function WaterSortTutorial({
  open,
  playStart,
  onClose,
}: WaterSortTutorialProps) {
  const [progress, setProgress] = useState<WaterSortTutorialProgress>(() =>
    startTutorial(waterSortTutorial),
  );
  // 盤面の動き。手のたびにイベントハンドラで作り、盤面が選択・注ぐ動き・揺れで応える。
  const [operation, setOperation] = useState<WaterSortOperation | null>(null);
  // 注ぐ動きの間は印を付けず、注ぎ終えてから次のボトルを示す。
  const [pouring, setPouring] = useState(false);
  // 注ぐ動きを見せている間に、一言と進み具合を留めておく、注ぐ前の進行。
  // 一言と進み具合が実際の動きより先に替わらないよう、注ぎ終えてから替える。
  const [progressBeforePour, setProgressBeforePour] =
    useState<WaterSortTutorialProgress | null>(null);
  const [idleProgress, setIdleProgress] =
    useState<WaterSortTutorialProgress | null>(null);
  const nextOperationIdRef = useRef(1);
  // 手を引いている間に、ルールに当たらない印の無いボトルを押されたら、押されるたびに印の線を短く濃くして戻す。
  // 揺れと違反の一言はルールに当たった手にだけ返すので、ここでは印へ目を向けさせるだけにする。
  const [recall, setRecall] = useState<{
    progress: WaterSortTutorialProgress;
    id: number;
  } | null>(null);
  const situation = getTutorialSituation(waterSortTutorial, progress);
  const guiding = situation.step !== null;
  const { boardState } = progress;
  const solving = progress.phase === "playing";
  const idleHintShown = !guiding && idleProgress === progress;
  const recallId = recall?.progress === progress ? recall.id : null;
  const shownProgress = progressBeforePour ?? progress;
  // 手を引いている間は、注ぐ動きを終えるまで次の手を受け付けず、どの手順の一言も必ず見せる。
  const guidedPourShowing =
    progressBeforePour !== null &&
    getTutorialSituation(waterSortTutorial, progressBeforePour).step !== null;
  const hintBottleIndex =
    !solving || pouring
      ? null
      : guiding
        ? getWaterSortTutorialStepBottleIndex(situation, boardState)
        : idleHintShown
          ? findWaterSortTutorialHintBottleIndex(boardState)
          : null;

  // ルールに合わない手のわけの一言を出しているか。印の線を濃くし直したときと、手を離した後に止まって印が出たときは、
  // 違反の一言を下げて、印のボトルへ向かう手順の一言か、残りをそろえる一言に戻す。
  const violationShown =
    progress.violated &&
    recallId === null &&
    !(idleHintShown && hintBottleIndex !== null);

  useWaterSortSoundEffects(operation, gameProgressByPhase[progress.phase]);

  useEffect(() => {
    if (!open || !solving || guiding) {
      return;
    }
    const timer = window.setTimeout(
      () => setIdleProgress(progress),
      IDLE_HINT_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, solving, guiding]);

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  const handlePourAnimationActivityChange = useCallback((active: boolean) => {
    setPouring(active);
    if (!active) {
      setProgressBeforePour(null);
    }
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  function handleSelectBottle(bottleIndex: number): void {
    const next = performTutorialAction(waterSortTutorial, progress, {
      bottleIndex,
    });
    if (next === progress) {
      if (guiding) {
        setRecall((current) => ({
          progress,
          id: current?.progress === progress ? current.id + 1 : 0,
        }));
      }
      return;
    }
    setProgress(next);
    if (next.boardState.lastMove?.type === "poured" && canAnimatePour()) {
      // 注いだ手は、それまでのルールに合わない手を直した手なので、注ぐ間に前の違反の一言を残さない。
      setProgressBeforePour((held) => held ?? { ...progress, violated: false });
    }
    setOperation(createOperation(next, nextOperationIdRef.current++));
  }

  function reset(): void {
    setIdleProgress(null);
    setProgressBeforePour(null);
    setRecall(null);
    setOperation(null);
    setProgress(startTutorial(waterSortTutorial));
  }

  // ゴールはもう見せたので、入口を通さずに最初の手順から始める。
  function handleRestart(): void {
    reset();
    setProgress(finishTutorialIntro);
  }

  // 終えたかどうかは残さないので、閉じたら次に開いたとき入口から始まるようにする。
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

  /** `shown` の進行で出す一言。手を離した後は、そろった色の数で応える。 */
  function describeProgress(
    shown: WaterSortTutorialProgress,
    violationOnScreen: boolean,
  ): TutorialMessage {
    if (shown.phase === "playing" && !violationOnScreen) {
      const { step } = getTutorialSituation(waterSortTutorial, shown);
      return step !== null
        ? describeWaterSortTutorialStep(step, shown.boardState)
        : describeWaterSortTutorialFreePlay(shown.boardState);
    }
    return getTutorialMessage(
      waterSortTutorial,
      { ...shown, violated: violationOnScreen },
      {
        entry: finish.entry,
        // 1回のタップで決まる手なので、一瞬だけ違反になる途中の状態は無い。
        violationSettled: true,
      },
    );
  }

  // 注ぐ動きの間は、一言と進み具合が実際の動きより先に替わらないよう、注ぐ前の進行で出す。
  const message =
    progressBeforePour !== null
      ? describeProgress(progressBeforePour, false)
      : describeProgress(progress, violationShown);
  const progressRatio =
    shownProgress.phase === "solved" || shownProgress.phase === "completed"
      ? 1
      : getWaterSortTutorialProgressRatio(
          shownProgress.stepIndex,
          shownProgress.boardState,
        );

  // そろった印は、注ぎ終えて盤面に見えてから出すよう、一言と同じく注ぐ前の進行で決める。
  const cues = getBottleCues(
    listWaterSortTutorialCompletedBottleIndices(shownProgress.boardState),
    hintBottleIndex,
    recallId,
  );

  /** 入口ではゴールの盤面を見せ、始めるときに、ゴールの盤面を薄くしながら始めの盤面に替える。 */
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
          <div className="flex size-full items-end justify-center">
            <div className="flex justify-center" style={boardFrameStyle}>
              <WaterSortBoard
                layout="single-row"
                state={showsGoal ? goalBottles : boardState.bottles}
                sourceBottleIndex={
                  showsGoal ? null : boardState.sourceBottleIndex
                }
                operation={showsGoal ? null : operation}
                interactionDisabled={showsGoal || !solving || guidedPourShowing}
                cues={showsGoal ? [] : cues}
                onSelectBottle={handleSelectBottle}
                onPourAnimationActivityChange={
                  showsGoal ? undefined : handlePourAnimationActivityChange
                }
                onClearAnimationComplete={
                  showsGoal ? undefined : handleClearAnimationComplete
                }
              />
            </div>
          </div>
        )}
      </TutorialCrossFadeIntroScene>
    );
  }

  return (
    <TutorialStage
      open={open}
      title={WATER_SORT_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      background={<WaterSortBackground />}
      intro={waterSortTutorial.intro}
      recap={waterSortTutorial.rules.map((rule) => rule.label)}
      message={message}
      phase={shownProgress.phase}
      progress={progressRatio}
      progressStepCount={WATER_SORT_TUTORIAL_PROGRESS_STEP_COUNT}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={handleRestart}
      onClose={handleClose}
    />
  );
}
