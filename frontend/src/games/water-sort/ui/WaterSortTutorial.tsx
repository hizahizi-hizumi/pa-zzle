import { useCallback, useEffect, useRef, useState } from "react";

import { TutorialCrossFadeIntroScene } from "@/components/TutorialCrossFadeIntroScene";
import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
} from "@/components/TutorialOverlay";
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
  describeWaterSortTutorialCompletion,
  findWaterSortTutorialHintBottleIndex,
  getWaterSortTutorialSpotlitBottleIndices,
  getWaterSortTutorialStepBottleIndex,
  isWaterSortTutorialFirstCompletion,
  type WaterSortTutorialBoardState,
  type WaterSortTutorialRuleId,
  waterSortTutorial,
  waterSortTutorialFirstCompletionMessage,
} from "@/games/water-sort/tutorial/tutorial";
import type { WaterSortBottleCue } from "@/games/water-sort/ui/board/bottle-cue";
import { WaterSortBoard } from "@/games/water-sort/ui/board/WaterSortBoard";
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
 * ボトルに重ねる合図。注いで1色そろったボトルへの応えと、次にタップするボトルの印。
 * 解き終えた手には、本番と同じ完成の動きだけで応える。`recallId` があれば、印の線を短く濃くして戻す。
 */
function getBottleCues(
  progress: WaterSortTutorialProgress,
  hintBottleIndex: number | null,
  recallId: number | null,
): WaterSortBottleCue[] {
  const completion =
    progress.phase === "playing" ? progress.boardState.completion : null;
  return [
    ...(completion === null
      ? []
      : [
          {
            bottleIndex: completion.bottleIndex,
            kind: "completed",
            id: completion.id,
          } as const,
        ]),
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
 * 3色の盤面を、一言と印に沿って1手ずつ注ぎ、ルールを1つずつ使って身につけさせる。
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
  // 注ぐ動きを見せている間に、一言とルールの並びを留めておく、注ぐ前の進行。
  // 一言とルールが実際の動きより先に替わらないよう、注ぎ終えてから替える。
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
  // 手を引いている間は、注ぐ動きを終えるまで次の手を受け付けず、どの手順の一言とルールも必ず見せる。
  const guidedPourShowing =
    progressBeforePour !== null &&
    getTutorialSituation(waterSortTutorial, progressBeforePour).step !== null;
  const shownSituation = getTutorialSituation(waterSortTutorial, shownProgress);
  // 手を引く間は、注ぐ動きの間も覆いを重ねたままにし、注ぐボトルを覆いの上の層で見せる。
  // 最後の手順の注ぎも、注ぎ終えて手を離すまで覆いを外さない。
  const focusScrimShown = solving && shownSituation.step !== null;
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

  function restart(): void {
    setIdleProgress(null);
    setProgressBeforePour(null);
    setRecall(null);
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
    playStart?.onStart();
  }

  /** `shown` の進行で出す一言。解き終えたら、自分で注いだ手数を最短の手数と並べて言う。 */
  function describeProgress(
    shown: WaterSortTutorialProgress,
    violationOnScreen: boolean,
  ): TutorialMessage {
    if (shown.phase === "solved" || shown.phase === "completed") {
      return describeWaterSortTutorialCompletion(shown.boardState);
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

  /**
   * 注ぐ動きの間は、注ぐ前の進行の一言を出す。
   * 盤面で初めて1色そろったら、次に注ぐかルールに合わない手を打つまで、そのことを言う。
   */
  function getMessage(): TutorialMessage {
    if (progressBeforePour !== null) {
      return describeProgress(progressBeforePour, false);
    }
    if (
      solving &&
      !violationShown &&
      isWaterSortTutorialFirstCompletion(boardState)
    ) {
      return waterSortTutorialFirstCompletionMessage;
    }
    return describeProgress(progress, violationShown);
  }

  const finish: TutorialFinish = playStart
    ? {
        entry: "home",
        difficulty: playStart.difficulty,
        onStartPlay: handleStartPlay,
      }
    : { entry: "play", onReturnToPlay: handleClose };

  // 注ぐ動きの間は、合図を出さず、注ぎ終えてから出す。
  const cues = pouring
    ? []
    : getBottleCues(progress, hintBottleIndex, recallId);
  // 印のボトルを押す所として元の明るさで、残りの決め手を一段暗く抜く。
  // 注ぐ動きの間は、元の場所のボトルを隠して覆いの上の層で動かすので、元の場所は抜かない。
  const spotlitBottles =
    !solving || pouring
      ? null
      : (getWaterSortTutorialSpotlitBottleIndices(situation)?.map(
          (bottleIndex) => ({
            bottleIndex,
            role:
              bottleIndex === hintBottleIndex
                ? ("target" as const)
                : ("clue" as const),
          }),
        ) ?? null);

  /** 導入の間はゴールの盤面を見せ、始めの盤面の場面では、ゴールの盤面を薄くしながら始めの盤面に替える。 */
  function renderBoard({ scene, playing, onSceneEnd }: TutorialBoardIntro) {
    return (
      <TutorialCrossFadeIntroScene
        scene={scene}
        playing={playing}
        onSceneEnd={onSceneEnd}
      >
        {(showsGoal) => (
          <WaterSortBoard
            state={showsGoal ? goalBottles : boardState.bottles}
            sourceBottleIndex={showsGoal ? null : boardState.sourceBottleIndex}
            operation={showsGoal ? null : operation}
            interactionDisabled={showsGoal || !solving || guidedPourShowing}
            cues={showsGoal ? [] : cues}
            spotlitBottles={showsGoal ? null : spotlitBottles}
            pourInFrontOfTutorialScrim={!showsGoal && focusScrimShown}
            onSelectBottle={handleSelectBottle}
            onPourAnimationActivityChange={
              showsGoal ? undefined : handlePourAnimationActivityChange
            }
            onClearAnimationComplete={
              showsGoal ? undefined : handleClearAnimationComplete
            }
          />
        )}
      </TutorialCrossFadeIntroScene>
    );
  }

  return (
    <TutorialOverlay
      open={open}
      title={WATER_SORT_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      background={<WaterSortBackground />}
      intro={waterSortTutorial.intro}
      rules={waterSortTutorial.rules.map((rule) => ({
        ...rule,
        earned: shownProgress.earnedRuleIds.includes(rule.id),
        current: shownSituation.step?.introducedRuleId === rule.id,
      }))}
      message={getMessage()}
      phase={progress.phase}
      guiding={focusScrimShown}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={restart}
      onClose={handleClose}
    />
  );
}
