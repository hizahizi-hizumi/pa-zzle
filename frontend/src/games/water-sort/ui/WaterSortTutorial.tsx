import { useCallback, useEffect, useRef, useState } from "react";

import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
} from "@/components/TutorialOverlay";
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
import { isCompleteWaterSortBottle } from "@/games/water-sort/puzzle/state";
import {
  findWaterSortTutorialHintBottle,
  getWaterSortTutorialShownStepIndex,
  getWaterSortTutorialStepBottle,
  listWaterSortTutorialPointedBottles,
  type WaterSortTutorialBoardState,
  type WaterSortTutorialRuleId,
  waterSortTutorial,
} from "@/games/water-sort/tutorial/tutorial";
import type { WaterSortBottleCue } from "@/games/water-sort/ui/board/bottle-cue";
import {
  POUR_ANIMATION_DURATION_MS,
  POUR_RETURN_START_OFFSET,
} from "@/games/water-sort/ui/board/pour/pour-animation";
import { WaterSortBoard } from "@/games/water-sort/ui/board/WaterSortBoard";
import { WaterSortTutorialIntroScene } from "@/games/water-sort/ui/WaterSortTutorial/WaterSortTutorialIntroScene";

type WaterSortTutorialProps = {
  open: boolean;
  /** 難易度選択から開いたときに渡す。終えたときにレベル1を始める操作を出す。渡さなければプレイ中に開いたとして、閉じてプレイに戻る操作を出す。 */
  onStartPlay?: () => void;
  onClose: () => void;
};

type WaterSortTutorialProgress = TutorialProgress<
  WaterSortTutorialRuleId,
  WaterSortTutorialBoardState
>;

/** 手を離した後、手が止まってから次に押すボトルを示すまでの間。 */
const IDLE_HINT_DELAY_MS = 4000;

const goalBottles = waterSortTutorial.goal().bottles;

/** 手の結果を、本番の盤面と同じ選ぶ・注ぐ・揺れの動きにする。 */
function createOperation(
  next: WaterSortTutorialProgress,
): WaterSortOperation | null {
  const { lastMove, moveCount, bottles } = next.boardState;
  switch (lastMove?.type) {
    case "selected":
      return {
        id: moveCount,
        type: "source-selected",
        bottleIndex: lastMove.bottleIndex,
      };
    case "deselected":
      return {
        id: moveCount,
        type: "source-deselected",
        bottleIndex: lastMove.bottleIndex,
      };
    case "rejected":
      return {
        id: moveCount,
        type: "invalid",
        bottleIndex: lastMove.bottleIndex,
      };
    case "poured":
      return {
        id: moveCount,
        type: "poured",
        ...lastMove.move,
        stateBefore: lastMove.bottlesBefore,
        stateAfter: bottles,
        isClearingMove: next.phase === "solved",
      };
    case undefined:
      return null;
  }
}

/** 注いだ先が1色で満杯にそろったら、そのボトルを一瞬光らせる。 */
/**
 * 注いだ先が1色で満杯にそろったら、そのボトルを一瞬光らせる。
 * 完成したときは、そろったボトルをすべて同時に光らせる。
 */
function getSortedCues(
  { bottles, lastMove, moveCount }: WaterSortTutorialBoardState,
  completed: boolean,
): WaterSortBottleCue[] {
  if (lastMove?.type !== "poured") {
    return [];
  }
  const sortedBottleIndices = completed
    ? bottles.flatMap((bottle, bottleIndex) =>
        isCompleteWaterSortBottle(bottle) ? [bottleIndex] : [],
      )
    : [lastMove.move.destinationBottleIndex].filter((bottleIndex) => {
        const bottle = bottles[bottleIndex];
        return bottle !== undefined && isCompleteWaterSortBottle(bottle);
      });
  return sortedBottleIndices.map((bottleIndex) => ({
    bottleIndex,
    kind: "sorted",
    id: moveCount,
  }));
}

/**
 * 3色の盤面を、一言と印に沿って1手ずつ注がせ、ルールを1つずつ使って身につけさせる。
 * 手順を終えたら手を離し、残りを自分でそろえさせる。盤面・注ぐ動き・揺れは本番と同じ部品を使う。
 */
export function WaterSortTutorial({
  open,
  onStartPlay,
  onClose,
}: WaterSortTutorialProps) {
  const [progress, setProgress] = useState<WaterSortTutorialProgress>(() =>
    startTutorial(waterSortTutorial),
  );
  // 盤面の動き。手のたびにイベントハンドラで作り、盤面が注ぐ動きや揺れで応える。
  const [operation, setOperation] = useState<WaterSortOperation | null>(null);
  // 注いでいる間は次の印を出さず、注ぎ終えてから付ける。
  const [pouring, setPouring] = useState(false);
  const [idleProgress, setIdleProgress] =
    useState<WaterSortTutorialProgress | null>(null);
  // 手を引いている間に印の無いボトルを押されたら、印を付け直す。
  const [hintCueId, setHintCueId] = useState(0);
  // 手順どおりに注いで次の手順へ進んだときの、進む前の進行。注ぐ動きを終えて次の印を付けるまで、一言とルールの並びをこちらで見せる。
  const [steppedPour, setSteppedPour] = useState<{
    progress: WaterSortTutorialProgress;
    before: WaterSortTutorialProgress;
  } | null>(null);
  // 最後に注いだボトルが戻り始めた、解けた進行。完成の一言は、ボトルが戻るのに合わせて出す。
  const [returningSolvedProgress, setReturningSolvedProgress] =
    useState<WaterSortTutorialProgress | null>(null);
  const returnTimerRef = useRef<number | undefined>(undefined);
  const situation = getTutorialSituation(waterSortTutorial, progress);
  const guiding = situation.step !== null;
  const { boardState } = progress;
  const playing = progress.phase === "playing";
  const idleHintShown = playing && !guiding && idleProgress === progress;
  const hintBottle =
    !playing || pouring
      ? null
      : guiding
        ? getWaterSortTutorialStepBottle(situation, boardState)
        : idleHintShown
          ? findWaterSortTutorialHintBottle(boardState)
          : null;
  const progressBeforePour =
    pouring && steppedPour?.progress === progress
      ? steppedPour.before
      : progress;
  const shownProgress: WaterSortTutorialProgress = {
    ...progressBeforePour,
    stepIndex: getWaterSortTutorialShownStepIndex(
      progressBeforePour.stepIndex,
      progressBeforePour.boardState,
    ),
  };
  const shownSituation = getTutorialSituation(waterSortTutorial, shownProgress);

  useEffect(() => {
    if (!open || progress.phase !== "playing" || guiding) {
      return;
    }
    const timer = window.setTimeout(
      () => setIdleProgress(progress),
      IDLE_HINT_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, guiding]);

  useEffect(() => {
    return () => window.clearTimeout(returnTimerRef.current);
  }, []);

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
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
        setHintCueId((id) => id + 1);
      }
      return;
    }
    setProgress(next);
    setOperation(createOperation(next));
    setSteppedPour(
      next.boardState.lastMove?.type === "poured" &&
        next.stepIndex !== progress.stepIndex
        ? { progress: next, before: progress }
        : null,
    );
    if (next.phase === "solved") {
      returnTimerRef.current = window.setTimeout(
        () => setReturningSolvedProgress(next),
        POUR_ANIMATION_DURATION_MS * POUR_RETURN_START_OFFSET,
      );
    }
    // 示した注ぎ元を選んだら、待たせずに注ぎ先も示す。
    if (idleHintShown && next.boardState.sourceBottleIndex === hintBottle) {
      setIdleProgress(next);
    }
  }

  function restart(): void {
    window.clearTimeout(returnTimerRef.current);
    setReturningSolvedProgress(null);
    setIdleProgress(null);
    setSteppedPour(null);
    setOperation(null);
    setPouring(false);
    setProgress(startTutorial(waterSortTutorial));
  }

  // 終えたかどうかは残さないので、閉じたら次に開いたとき最初から始まるようにする。
  function handleClose(): void {
    restart();
    onClose();
  }

  function handleStartPlay(): void {
    restart();
    onStartPlay?.();
  }

  const finish: TutorialFinish = onStartPlay
    ? { entry: "selection", onStartPlay: handleStartPlay }
    : { entry: "play", onReturnToPlay: handleClose };

  /**
   * 注いでいる間は、注ぐ前の一言を残す。次の手順の一言は次の印と一緒に、完成の一言は最後に注いだボトルが戻るのに合わせて出す。
   * 手を離した後に止まって印が出たら、前の違反の一言は下げて、残りをそろえる一言に戻す。
   */
  function getMessage(): TutorialMessage {
    if (progress.phase === "solved" && returningSolvedProgress !== progress) {
      return waterSortTutorial.freePlay;
    }
    if (idleHintShown && hintBottle !== null) {
      return waterSortTutorial.freePlay;
    }
    return getTutorialMessage(waterSortTutorial, shownProgress, {
      entry: finish.entry,
      // 1回のタップで決まる手なので、一瞬だけ違反になる途中の状態は無い。
      violationSettled: true,
    });
  }

  /**
   * そろった合図は、注ぐ動きを終えてボトルが戻ってから光らせる。
   * 導入の終わりは、最初の手順の一言を出すのと同時に、最初の印を付ける。
   */
  function getCues(messageShown: boolean): WaterSortBottleCue[] {
    const pointedCues: WaterSortBottleCue[] =
      listWaterSortTutorialPointedBottles(shownSituation, boardState).map(
        (bottleIndex) => ({ bottleIndex, kind: "pointed", id: 0 }),
      );
    const sortedCues =
      pouring || progress.phase === "solved"
        ? []
        : getSortedCues(boardState, false);
    const cueBottle =
      progress.phase === "intro"
        ? messageShown
          ? getWaterSortTutorialStepBottle(situation, boardState)
          : null
        : hintBottle;
    // 同じボトルに重なったら、指し続ける合図を一瞬の合図より先に置いて残す。
    const cues = [...pointedCues, ...sortedCues];
    return cueBottle === null
      ? cues
      : [...cues, { bottleIndex: cueBottle, kind: "hint", id: hintCueId }];
  }

  /** 導入の間はゴールの盤面を見せ、始めの盤面の場面で、始めの盤面へ替える。 */
  function renderBoard({
    scene,
    playing: scenePlaying,
    onSceneEnd,
    messageShown,
  }: TutorialBoardIntro) {
    return (
      <WaterSortTutorialIntroScene
        scene={scene}
        playing={scenePlaying}
        onSceneEnd={onSceneEnd}
      >
        {(showsGoal) => (
          // 端から2本目へ注ぐとき、傾けたボトルは注ぎ先の中心から画面の端の側へ、ボトルの幅の約2.76倍はみ出す。
          // 傾けたボトルも画面の端から16px以上離れるよう、ボトルの幅を (100cqw - 28px) / 7.52 までに抑える。
          // 100cqw は画面幅から左右16pxの余白を除いた幅で、28px はボトルの隙間2つ分。
          <div className="mx-auto flex h-full w-[min(100cqw,26rem,calc(150cqh+56px),calc((100cqw-28px)*5/7.52+56px))] items-center">
            <WaterSortBoard
              state={showsGoal ? goalBottles : boardState.bottles}
              sourceBottleIndex={
                scene === null ? boardState.sourceBottleIndex : null
              }
              operation={scene === null ? operation : null}
              arrangement="single-row"
              cues={scene === null ? getCues(messageShown) : []}
              interactionDisabled={progress.phase !== "playing"}
              onSelectBottle={handleSelectBottle}
              onPourAnimationActivityChange={setPouring}
              onClearAnimationComplete={handleClearAnimationComplete}
            />
          </div>
        )}
      </WaterSortTutorialIntroScene>
    );
  }

  return (
    <TutorialOverlay
      open={open}
      title={WATER_SORT_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      intro={waterSortTutorial.intro}
      rules={waterSortTutorial.rules.map((rule) => ({
        ...rule,
        earned: shownProgress.earnedRuleIds.includes(rule.id),
        current: shownSituation.step?.introducedRuleId === rule.id,
      }))}
      message={getMessage()}
      introducing={progress.phase === "intro"}
      completed={progress.phase === "completed"}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={restart}
      onClose={handleClose}
    />
  );
}
