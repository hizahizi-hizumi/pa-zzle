import { useCallback, useEffect, useState } from "react";

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
import {
  findWaterSortTutorialHintBottle,
  getWaterSortTutorialStepBottle,
  type WaterSortTutorialBoardState,
  type WaterSortTutorialRuleId,
  waterSortTutorial,
} from "@/games/water-sort/tutorial/tutorial";
import type { WaterSortBottleCue } from "@/games/water-sort/ui/board/bottle-cue";
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
    // 示した注ぎ元を選んだら、待たせずに注ぎ先も示す。
    if (idleHintShown && next.boardState.sourceBottleIndex === hintBottle) {
      setIdleProgress(next);
    }
  }

  function restart(): void {
    setIdleProgress(null);
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

  /** 手を離した後に止まって印が出たら、前の違反の一言は下げて、残りをそろえる一言に戻す。 */
  function getMessage(): TutorialMessage {
    if (idleHintShown && hintBottle !== null) {
      return waterSortTutorial.freePlay;
    }
    return getTutorialMessage(waterSortTutorial, progress, {
      entry: finish.entry,
      // 1回のタップで決まる手なので、一瞬だけ違反になる途中の状態は無い。
      violationSettled: true,
    });
  }

  const cues: WaterSortBottleCue[] =
    hintBottle === null
      ? []
      : [{ bottleIndex: hintBottle, kind: "hint", id: hintCueId }];

  /** 導入の間はゴールの盤面を見せ、始めの盤面の場面で、始めの盤面へ替える。 */
  function renderBoard({
    scene,
    playing: scenePlaying,
    onSceneEnd,
  }: TutorialBoardIntro) {
    return (
      <WaterSortTutorialIntroScene
        scene={scene}
        playing={scenePlaying}
        onSceneEnd={onSceneEnd}
      >
        {(showsGoal) => (
          <div className="mx-auto flex h-full w-[min(100cqw,26rem,calc(150cqh+56px))] items-center">
            <WaterSortBoard
              state={showsGoal ? goalBottles : boardState.bottles}
              sourceBottleIndex={
                scene === null ? boardState.sourceBottleIndex : null
              }
              operation={scene === null ? operation : null}
              arrangement="single-row"
              cues={cues}
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
        earned: progress.earnedRuleIds.includes(rule.id),
        current: situation.step?.introducedRuleId === rule.id,
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
