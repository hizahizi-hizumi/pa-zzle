import { useCallback, useEffect, useRef, useState } from "react";

import { TutorialCrossFadeIntroScene } from "@/components/TutorialCrossFadeIntroScene";
import {
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
  type TutorialStageBoardIntro,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/bridges/assets/pictogram.svg?raw";
import { BRIDGES_DISPLAY_NAME } from "@/games/bridges/display-name";
import type { BridgesEdgeNotice } from "@/games/bridges/play/use-bridges-play";
import {
  BRIDGES_TUTORIAL_BOARD,
  BRIDGES_TUTORIAL_PROGRESS_STEP_COUNT,
  type BridgesTutorialBoardState,
  type BridgesTutorialHint,
  type BridgesTutorialReason,
  type BridgesTutorialRuleId,
  bridgesTutorial,
  describeBridgesTutorialHint,
  describeBridgesTutorialOffStep,
  describeBridgesTutorialStep,
  findBridgesTutorialFix,
  findBridgesTutorialHint,
  getBridgesTutorialIslandStatuses,
  getBridgesTutorialProgressRatio,
  getBridgesTutorialStepEdges,
  getBridgesTutorialStepReason,
} from "@/games/bridges/tutorial/tutorial";
import { BridgesGround } from "@/games/bridges/ui/BridgesGround";
import { BridgesHowToPlayDialog } from "@/games/bridges/ui/BridgesHowToPlayDialog";
import { BridgesStatusAnnouncement } from "@/games/bridges/ui/BridgesPlay/BridgesStatusAnnouncement";
import { useBridgesSoundEffects } from "@/games/bridges/ui/BridgesPlay/use-bridges-sound-effects";
import { BridgesBoard } from "@/games/bridges/ui/board/BridgesBoard";
import type {
  BridgesBoardCue,
  BridgesBoardSpotlight,
} from "@/games/bridges/ui/board/board-cue";
import { BOARD_SETTLE_DELAY_MS } from "@/games/bridges/ui/board-settle-delay";
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

type BridgesTutorialProps = {
  open: boolean;
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type BridgesTutorialProgress = TutorialProgress<
  BridgesTutorialRuleId,
  BridgesTutorialBoardState
>;

/** 手順を終えてから次の手順の一言と決め手に替えるまでの間。架けた橋が伸びきるのと、その手への応えを見せてから替える。 */
const NEXT_STEP_DELAY_MS = 900;

const goalBoardState = bridgesTutorial.goal();

const recap = [
  ...bridgesTutorial.rules.map((rule) => rule.label),
  "全部の島を1つにつなぐと完成です",
];

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

/**
 * 辺に重ねる印と応え。
 * - 手順の辺を手順の本数まで架けたら、その辺に応える。
 * - 次に押す辺（操作の手順の辺、手がかりの辺、直す辺）に印を付け、押し直すとき（`recallId`）だけ印の線を濃くする。
 *   指は操作の手順だけに添える。手がかりと直す辺は、指がすぐ下の島の数字を隠すので、輪郭だけにする。
 */
function getCues(
  { lastMove, moveCount }: BridgesTutorialBoardState,
  markedEdges: readonly number[],
  pointed: boolean,
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
    ...markedEdges.map((edge) => ({
      kind: "mark" as const,
      edge,
      pointed,
      recallId,
    })),
  ];
}

function toSpotlight(
  reason: BridgesTutorialReason,
  edges: readonly number[],
): BridgesBoardSpotlight {
  return {
    islands: reason.islands,
    edges: [...new Set([...reason.edges, ...edges])],
  };
}

export function BridgesTutorial({
  open,
  playStart,
  onClose,
}: BridgesTutorialProps) {
  const [progress, setProgress] = useState<BridgesTutorialProgress>(() =>
    startTutorial(bridgesTutorial),
  );
  const [settledViolationProgress, setSettledViolationProgress] =
    useState<BridgesTutorialProgress | null>(null);
  const [hintRequestedProgress, setHintRequestedProgress] =
    useState<BridgesTutorialProgress | null>(null);
  // 手を引いている間に手順に無い辺を押したときの進行と、押した辺（盤面の外なら `null`）。
  const [offStepPress, setOffStepPress] = useState<{
    progress: BridgesTutorialProgress;
    edge: number | null;
  } | null>(null);
  const [recall, setRecall] = useState<BridgesTutorialRecall | null>(null);
  // 手順を終えた手の進行と、その手の前の進行。架けた橋と決め手を残して見せる間は、一言も終えた手順のままにする。
  const [finishedStep, setFinishedStep] = useState<{
    progress: BridgesTutorialProgress;
    previous: BridgesTutorialProgress;
  } | null>(null);
  const [lingerEndedProgress, setLingerEndedProgress] =
    useState<BridgesTutorialProgress | null>(null);
  const [edgeNotice, setEdgeNotice] = useState<BridgesEdgeNotice | null>(null);
  // 開き直しても同じ知らせとみなされないよう、もう一度始めても数え直さない。
  const noticeIdRef = useRef(0);
  const situation = getTutorialSituation(bridgesTutorial, progress);
  const guiding = situation.step !== null;
  const solving = progress.phase === "playing";
  const { boardState } = progress;
  const recallId = recall?.progress === progress ? recall.id : null;
  // 阻まれた手は一瞬だけの違反にならないので、待たずに応える。
  const violationSettled =
    settledViolationProgress === progress ||
    boardState.lastMove?.kind === "blocked";

  // 手順を終えたら、架けた橋と決め手と一言を少し残して見せてから、次の手順か手を離した後へ替える。
  const lingeringProgress =
    solving &&
    finishedStep?.progress === progress &&
    lingerEndedProgress !== progress
      ? finishedStep.previous
      : null;
  const shownSituation = getTutorialSituation(
    bridgesTutorial,
    lingeringProgress ?? progress,
  );
  const shownStep = shownSituation.step;

  const hintRequestable =
    solving && !guiding && lingeringProgress === null && !progress.violated;
  const hint: BridgesTutorialHint | null =
    hintRequestable && hintRequestedProgress === progress
      ? findBridgesTutorialHint(situation, boardState)
      : null;
  const fix =
    solving && !guiding && progress.violated && violationSettled
      ? findBridgesTutorialFix(boardState)
      : null;
  const markedEdges =
    lingeringProgress === null && solving
      ? guiding
        ? getBridgesTutorialStepEdges(situation, boardState)
        : hint
          ? [hint.edge]
          : fix
            ? [fix.edge]
            : []
      : [];
  const stepReason =
    solving && shownStep !== null
      ? getBridgesTutorialStepReason(shownSituation, boardState)
      : null;
  const spotlight: BridgesBoardSpotlight | null = stepReason
    ? toSpotlight(stepReason, [])
    : hint?.reason
      ? toSpotlight(hint.reason, [hint.edge])
      : null;

  useBridgesSoundEffects(
    edgeNotice,
    soundProgressByPhase[progress.phase],
    BRIDGES_TUTORIAL_BOARD,
    boardState.bridges,
  );

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

  useEffect(() => {
    if (!open || lingeringProgress === null) {
      return;
    }
    const timer = window.setTimeout(
      () => setLingerEndedProgress(progress),
      NEXT_STEP_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, progress, lingeringProgress]);

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  // 阻まれた手は、本番と同じ阻まれた反応を返した後の進行で応える。
  function answerOffStepPress(
    edge: number | null,
    pressedProgress: BridgesTutorialProgress = progress,
  ): void {
    // 終えた手順を残して見せる間は、終えた手順の一言を保ち、次の手順のルールの一言を飛ばさないよう応えない。
    if (!guiding || !solving || lingeringProgress !== null) {
      return;
    }
    if (getBridgesTutorialStepEdges(situation, boardState).length > 0) {
      setRecall((current) => ({
        id: (current?.id ?? 0) + 1,
        progress: pressedProgress,
      }));
      return;
    }
    setOffStepPress({ progress: pressedProgress, edge });
  }

  function handleCycleEdge(edge: number): void {
    const next = performTutorialAction(bridgesTutorial, progress, {
      type: "cycle",
      edge,
    });
    if (next === progress) {
      answerOffStepPress(edge);
      return;
    }
    noticeIdRef.current += 1;
    setEdgeNotice(createEdgeNotice(next.boardState, noticeIdRef.current));
    if (next.stepIndex !== progress.stepIndex) {
      setFinishedStep({ progress: next, previous: progress });
    }
    setProgress(next);
    // 交差のルールを伝える前に阻まれた手は違反にならないので、手順に無い手として返す。
    if (next.boardState.lastMove?.kind === "blocked" && !next.violated) {
      answerOffStepPress(edge, next);
    }
  }

  function restart(): void {
    setSettledViolationProgress(null);
    setHintRequestedProgress(null);
    setOffStepPress(null);
    setRecall(null);
    setFinishedStep(null);
    setLingerEndedProgress(null);
    setEdgeNotice(null);
    setProgress(startTutorial(bridgesTutorial));
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

  function renderBoard({
    scene,
    playing,
    onSceneEnd,
  }: TutorialStageBoardIntro) {
    return (
      <div className="relative aspect-square w-[min(100cqw,100cqh,36rem)]">
        <TutorialCrossFadeIntroScene
          scene={scene}
          playing={playing}
          onSceneEnd={onSceneEnd}
        >
          {(showsGoal) => {
            const shownState = showsGoal ? goalBoardState : boardState;
            const live = !showsGoal && scene === null;
            return (
              <BridgesBoard
                board={BRIDGES_TUTORIAL_BOARD}
                bridges={shownState.bridges}
                islandStatuses={getBridgesTutorialIslandStatuses(shownState)}
                edgeNotice={live ? edgeNotice : null}
                clearing={live && progress.phase === "solved"}
                solved={
                  live &&
                  (progress.phase === "solved" ||
                    progress.phase === "completed")
                }
                interactionDisabled={!live || !solving}
                showsSea
                cues={
                  live
                    ? getCues(boardState, markedEdges, guiding, recallId)
                    : []
                }
                spotlight={live ? spotlight : null}
                guidedEdges={live && guiding ? markedEdges : []}
                onCycleEdge={handleCycleEdge}
                onIneffectivePress={() => answerOffStepPress(null)}
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

  function getMessage(): TutorialMessage {
    // 手順に無い手には、前の手で阻まれた一言が残っていても、今押した手への一言で返す。
    if (
      shownStep !== null &&
      lingeringProgress === null &&
      offStepPress?.progress === progress
    ) {
      return describeBridgesTutorialOffStep(
        shownStep,
        boardState,
        offStepPress.edge,
      );
    }
    const shownProgress = lingeringProgress ?? progress;
    const base = getTutorialMessage(bridgesTutorial, shownProgress, {
      entry: finish.entry,
      violationSettled: shownProgress === progress && violationSettled,
    });
    if (shownStep !== null && base === shownStep.message) {
      // 終えた手順を残して見せる間も、途中の一言かどうかは架け終えた今の盤面で決める。
      return describeBridgesTutorialStep(shownStep, boardState);
    }
    if (hint && base === bridgesTutorial.freePlay) {
      return describeBridgesTutorialHint(hint);
    }
    return base;
  }

  return (
    <TutorialOverlay
      presentation="stage"
      open={open}
      title={BRIDGES_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      background={<BridgesGround />}
      intro={bridgesTutorial.intro}
      recap={recap}
      message={getMessage()}
      phase={progress.phase}
      spotlighting={spotlight !== null}
      progress={
        solving || progress.phase === "intro"
          ? getBridgesTutorialProgressRatio(boardState)
          : 1
      }
      progressStepCount={BRIDGES_TUTORIAL_PROGRESS_STEP_COUNT}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={handleRestart}
      renderHowToPlayDialog={(control) => (
        <BridgesHowToPlayDialog {...control} />
      )}
      onRequestHint={
        hintRequestable && hint === null
          ? () => setHintRequestedProgress(progress)
          : null
      }
      onClose={handleClose}
    />
  );
}
