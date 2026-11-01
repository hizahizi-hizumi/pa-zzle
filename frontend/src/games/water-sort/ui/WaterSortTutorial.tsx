import { useCallback, useEffect, useState } from "react";

import {
  type TutorialBoardIntro,
  TutorialCrossFadeIntroScene,
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
  describeWaterSortTutorialOffStepTap,
  findWaterSortTutorialHintBottleIndex,
  getWaterSortTutorialStepBottleIndex,
  type WaterSortTutorialBoardState,
  type WaterSortTutorialRuleId,
  waterSortTutorial,
} from "@/games/water-sort/tutorial/tutorial";
import type { WaterSortBottleCue } from "@/games/water-sort/ui/board/bottle-cue";
import { WaterSortBoard } from "@/games/water-sort/ui/board/WaterSortBoard";

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

/** 手を離した後、手が止まってから次にタップするボトルを示すまでの間。 */
const IDLE_HINT_DELAY_MS = 4000;

const goalBottles = waterSortTutorial.goal().bottles;

/**
 * 盤面の高さが領域に収まる幅。5本のボトルは `WaterSortBoard` で3列2段に並び、
 * ボトルの高さは幅の 1/0.36 倍、列の間は18px、段の間は44pxあく。印がボトルの上下へはみ出すぶんも空けておく。
 */
const BOARD_WIDTH = "min(100cqw, calc(54cqh + 6px))";

/** 手の結果を、盤面の選択・注ぐ動き・揺れにする。 */
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
 * 3色の盤面を、一言と印に沿って1手ずつ注ぎ、ルールを1つずつ使って身につけさせる。
 * 手順を終えたら手を離し、残りを自分でそろえさせる。盤面・注ぐ動き・最後に注いでそろう動きは本番と同じ部品を使う。
 */
export function WaterSortTutorial({
  open,
  onStartPlay,
  onClose,
}: WaterSortTutorialProps) {
  const [progress, setProgress] = useState<WaterSortTutorialProgress>(() =>
    startTutorial(waterSortTutorial),
  );
  // 盤面の動き。手のたびにイベントハンドラで作り、盤面が選択・注ぐ動き・揺れで応える。
  const [operation, setOperation] = useState<WaterSortOperation | null>(null);
  // 注ぐ動きの間は印を付けず、注ぎ終えてから次のボトルを示す。
  const [pouring, setPouring] = useState(false);
  const [idleProgress, setIdleProgress] =
    useState<WaterSortTutorialProgress | null>(null);
  // 手を引いている間に印の無いボトルを押されたら、印を付け直す。
  const [hintCueId, setHintCueId] = useState(0);
  // 手を引いている間に、印の無いボトルをタップしたときの一言。進行が変わるまで出す。
  const [offStepAnswer, setOffStepAnswer] = useState<{
    progress: WaterSortTutorialProgress;
    message: TutorialMessage;
  } | null>(null);
  const situation = getTutorialSituation(waterSortTutorial, progress);
  const guiding = situation.step !== null;
  const { boardState } = progress;
  const solving = progress.phase === "playing";
  const idleHintShown = !guiding && idleProgress === progress;
  const hintBottleIndex =
    !solving || pouring
      ? null
      : guiding
        ? getWaterSortTutorialStepBottleIndex(situation, boardState)
        : idleHintShown
          ? findWaterSortTutorialHintBottleIndex(boardState)
          : null;

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
        const answer = describeWaterSortTutorialOffStepTap(
          situation,
          boardState,
          bottleIndex,
        );
        setOffStepAnswer(answer && { progress, message: answer });
      }
      return;
    }
    setProgress(next);
    setOperation(createOperation(next));
  }

  function restart(): void {
    setIdleProgress(null);
    setOffStepAnswer(null);
    setOperation(null);
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

  /**
   * 印の無いボトルへの答えは、進行が変わるまで出す。
   * 手を離した後に止まって印が出たら、前の違反の一言は下げて、残りをそろえる一言に戻す。
   */
  function getMessage(): TutorialMessage {
    if (offStepAnswer?.progress === progress) {
      return offStepAnswer.message;
    }
    if (idleHintShown && hintBottleIndex !== null) {
      return waterSortTutorial.freePlay;
    }
    return getTutorialMessage(waterSortTutorial, progress, {
      entry: finish.entry,
      // 1回のタップで決まる手なので、一瞬だけ違反になる途中の状態は無い。
      violationSettled: true,
    });
  }

  const finish: TutorialFinish = onStartPlay
    ? { entry: "selection", onStartPlay: handleStartPlay }
    : { entry: "play", onReturnToPlay: handleClose };

  const cues: WaterSortBottleCue[] =
    hintBottleIndex === null
      ? []
      : [{ bottleIndex: hintBottleIndex, kind: "hint", id: hintCueId }];

  /** 導入の間はゴールの盤面を見せ、始めの盤面の場面では、ゴールの盤面を薄くしながら始めの盤面に替える。 */
  function renderBoard({ scene, playing, onSceneEnd }: TutorialBoardIntro) {
    return (
      <TutorialCrossFadeIntroScene
        scene={scene}
        playing={playing}
        onSceneEnd={onSceneEnd}
      >
        {(showsGoal) => (
          <div className="flex size-full items-center justify-center">
            <div className="flex justify-center" style={{ width: BOARD_WIDTH }}>
              <WaterSortBoard
                state={showsGoal ? goalBottles : boardState.bottles}
                sourceBottleIndex={
                  showsGoal ? null : boardState.sourceBottleIndex
                }
                operation={showsGoal ? null : operation}
                interactionDisabled={showsGoal || !solving}
                cues={showsGoal ? [] : cues}
                onSelectBottle={handleSelectBottle}
                onPourAnimationActivityChange={
                  showsGoal ? undefined : setPouring
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
