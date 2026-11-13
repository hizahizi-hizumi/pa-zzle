import { useCallback, useEffect, useRef, useState } from "react";

import { TutorialCrossFadeIntroScene } from "@/components/TutorialCrossFadeIntroScene";
import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/bridges/assets/pictogram.svg?raw";
import { BRIDGES_DISPLAY_NAME } from "@/games/bridges/display-name";
import type { BridgesEdgeNotice } from "@/games/bridges/play/use-bridges-play";
import {
  BRIDGES_TUTORIAL_BOARD,
  type BridgesTutorialBoardState,
  type BridgesTutorialRuleId,
  bridgesTutorial,
  findBridgesTutorialHintEdge,
  getBridgesTutorialIslandStatuses,
  getBridgesTutorialSpotlight,
  getBridgesTutorialStepEdge,
  hasBridgesTutorialBoardViolation,
} from "@/games/bridges/tutorial/tutorial";
import { BridgesStatusAnnouncement } from "@/games/bridges/ui/BridgesPlay/BridgesStatusAnnouncement";
import { useBridgesSoundEffects } from "@/games/bridges/ui/BridgesPlay/use-bridges-sound-effects";
import { BridgesBoard } from "@/games/bridges/ui/board/BridgesBoard";
import type { BridgesBoardCue } from "@/games/bridges/ui/board/board-cue";
import { BOARD_SETTLE_DELAY_MS } from "@/games/bridges/ui/board-settle-delay";
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

type BridgesTutorialProps = {
  open: boolean;
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type BridgesTutorialProgress = TutorialProgress<
  BridgesTutorialRuleId,
  BridgesTutorialBoardState
>;

const IDLE_HINT_DELAY_MS = 4000;

const goalBoardState = bridgesTutorial.goal();

/**
 * 手を引いている間に印の無い所を押されたときの、印の押し直し。印の線を短く濃くして戻す。
 * - `id`: 押されるたびに増やし、続けて押されても押し直す。
 */
type BridgesTutorialRecall = {
  id: number;
  progress: BridgesTutorialProgress;
};

const soundProgressByPhase = {
  intro: "playing",
  playing: "playing",
  solved: "clearing",
  completed: "result",
} as const satisfies Record<TutorialPhase, GameProgress>;

function createEdgeNotice(
  { bridges, lastMove }: BridgesTutorialBoardState,
  id: number,
): BridgesEdgeNotice | null {
  if (lastMove === null) {
    return null;
  }
  return lastMove.kind === "blocked"
    ? {
        id,
        change: "blocked",
        edge: lastMove.edge,
        crossingEdges: lastMove.crossingEdges,
      }
    : {
        id,
        change: "changed",
        edge: lastMove.edge,
        count: bridges[lastMove.edge]!,
      };
}

function getCues(
  { lastMove, moveCount }: BridgesTutorialBoardState,
  markedEdge: number | null,
  recallId: number | null,
): BridgesBoardCue[] {
  return [
    ...(lastMove?.kind === "changed" && lastMove.fitsStep
      ? [
          {
            kind: "acknowledgement" as const,
            edge: lastMove.edge,
            id: moveCount,
          },
        ]
      : []),
    ...(markedEdge === null
      ? []
      : [{ kind: "mark" as const, edge: markedEdge, recallId }]),
  ];
}

export function BridgesTutorial({
  open,
  playStart,
  onClose,
}: BridgesTutorialProps) {
  const [progress, setProgress] = useState<BridgesTutorialProgress>(() =>
    startTutorial(bridgesTutorial),
  );
  const [idleProgress, setIdleProgress] =
    useState<BridgesTutorialProgress | null>(null);
  const [settledViolationProgress, setSettledViolationProgress] =
    useState<BridgesTutorialProgress | null>(null);
  const [recall, setRecall] = useState<BridgesTutorialRecall | null>(null);
  const [edgeNotice, setEdgeNotice] = useState<BridgesEdgeNotice | null>(null);
  // 開き直しても同じ知らせとみなされないよう、もう一度始めても数え直さない。
  const noticeIdRef = useRef(0);
  const situation = getTutorialSituation(bridgesTutorial, progress);
  const guiding = situation.step !== null;
  const { boardState } = progress;
  const recallId = recall?.progress === progress ? recall.id : null;
  // 阻まれた手は盤面を変えないので、盤面にルールに合わないところが無ければ、止まったときに手がかりを出す。
  const idleHintPending =
    progress.phase === "playing" &&
    !guiding &&
    !hasBridgesTutorialBoardViolation(situation, boardState);
  const idleHintEdge =
    idleHintPending && idleProgress === progress
      ? findBridgesTutorialHintEdge(situation, boardState)
      : null;
  // 手がかりで外させている橋を外す途中は、外し終えるまで待たずに同じ辺へ印を付け続ける。
  const removingEdge =
    !guiding &&
    boardState.lastMove?.kind === "changed" &&
    boardState.lastMove.removing
      ? boardState.lastMove.edge
      : null;
  const markedEdge = guiding
    ? getBridgesTutorialStepEdge(situation, boardState)
    : (removingEdge ?? idleHintEdge);

  useBridgesSoundEffects(
    edgeNotice,
    soundProgressByPhase[progress.phase],
    BRIDGES_TUTORIAL_BOARD,
    boardState.bridges,
  );

  useEffect(() => {
    if (!open || !idleHintPending) {
      return;
    }
    const timer = window.setTimeout(
      () => setIdleProgress(progress),
      IDLE_HINT_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, idleHintPending]);

  useEffect(() => {
    if (!open || !progress.violated) {
      return;
    }
    const timer = window.setTimeout(
      () => setSettledViolationProgress(progress),
      BOARD_SETTLE_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress]);

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  /**
   * 印の無い所を押されたら、赤は使わず、印の線を短く濃くして目を向けさせる。
   * `pressed` は押した後の進行。阻まれた手は、本番と同じ阻まれた反応を返した後の進行で印を濃くする。
   */
  function recallHint(pressed: BridgesTutorialProgress = progress): void {
    setRecall((current) => ({ id: (current?.id ?? 0) + 1, progress: pressed }));
  }

  function handleIneffectivePress(): void {
    if (guiding && progress.phase === "playing") {
      recallHint();
    }
  }

  function handleCycleEdge(edge: number): void {
    const next = performTutorialAction(bridgesTutorial, progress, {
      type: "cycle",
      edge,
    });
    if (next === progress) {
      handleIneffectivePress();
      return;
    }
    noticeIdRef.current += 1;
    setEdgeNotice(createEdgeNotice(next.boardState, noticeIdRef.current));
    setProgress(next);
    if (guiding && next.boardState.lastMove?.kind === "blocked") {
      recallHint(next);
    }
  }

  function restart(): void {
    setIdleProgress(null);
    setSettledViolationProgress(null);
    setRecall(null);
    setEdgeNotice(null);
    setProgress(startTutorial(bridgesTutorial));
  }

  function handleClose(): void {
    restart();
    onClose();
  }

  function handleStartPlay(): void {
    restart();
    playStart?.onStart();
  }

  function renderBoard({
    scene,
    playing,
    onSceneEnd,
    messageShown,
  }: TutorialBoardIntro) {
    const solving = progress.phase === "playing";
    // 最初の手順の印は、導入の終わりに一言と同時に出す。
    const cuesShown = solving || (scene === null && messageShown);
    return (
      <div className="relative aspect-square w-[min(100cqw,100cqh,36rem)] self-center">
        <TutorialCrossFadeIntroScene
          scene={scene}
          playing={playing}
          onSceneEnd={onSceneEnd}
        >
          {(showsGoal) => {
            const shownState = showsGoal ? goalBoardState : boardState;
            return (
              <BridgesBoard
                board={BRIDGES_TUTORIAL_BOARD}
                bridges={shownState.bridges}
                islandStatuses={getBridgesTutorialIslandStatuses(shownState)}
                edgeNotice={showsGoal ? null : edgeNotice}
                clearing={!showsGoal && progress.phase === "solved"}
                solved={
                  !showsGoal &&
                  (progress.phase === "solved" ||
                    progress.phase === "completed")
                }
                interactionDisabled={showsGoal || !solving}
                showsSea
                cues={
                  showsGoal || !cuesShown
                    ? []
                    : getCues(boardState, markedEdge, recallId)
                }
                spotlight={
                  !showsGoal && solving && guiding
                    ? getBridgesTutorialSpotlight(situation, boardState)
                    : null
                }
                onCycleEdge={handleCycleEdge}
                guidedEdges={
                  !showsGoal && solving && guiding && markedEdge !== null
                    ? [markedEdge]
                    : []
                }
                acceptsEdgePress={
                  !guiding || situation.step?.gesture !== "fromIsland"
                }
                onIneffectivePress={handleIneffectivePress}
                onClearAnimationComplete={handleClearAnimationComplete}
              />
            );
          }}
        </TutorialCrossFadeIntroScene>
        <BridgesStatusAnnouncement
          board={BRIDGES_TUTORIAL_BOARD}
          notice={edgeNotice}
          solved={progress.phase === "solved" || progress.phase === "completed"}
        />
      </div>
    );
  }

  const finish: TutorialFinish = playStart
    ? {
        entry: "home",
        difficulty: playStart.difficulty,
        onStartPlay: handleStartPlay,
      }
    : { entry: "play", onReturnToPlay: handleClose };

  return (
    <TutorialOverlay
      open={open}
      title={BRIDGES_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      intro={bridgesTutorial.intro}
      rules={bridgesTutorial.rules.map((rule) => ({
        ...rule,
        earned: progress.earnedRuleIds.includes(rule.id),
        current: situation.step?.introducedRuleId === rule.id,
      }))}
      message={getTutorialMessage(bridgesTutorial, progress, {
        entry: finish.entry,
        violationSettled: settledViolationProgress === progress,
      })}
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
