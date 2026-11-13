import { useCallback, useEffect, useRef, useState } from "react";
import { TutorialCrossFadeIntroScene } from "@/components/TutorialCrossFadeIntroScene";
import {
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
  type TutorialStageBoardIntro,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/parking-jam/assets/pictogram.svg?raw";
import { PARKING_JAM_DISPLAY_NAME } from "@/games/parking-jam/display-name";
import type { ParkingJamOperation } from "@/games/parking-jam/play/use-parking-jam-play";
import type {
  ParkingJamDirection,
  ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import {
  describeParkingJamTutorialHint,
  findParkingJamTutorialDecider,
  findParkingJamTutorialHint,
  getParkingJamTutorialProgressRatio,
  getParkingJamTutorialStepMove,
  listParkingJamTutorialSolution,
  listParkingJamTutorialStepContacts,
  PARKING_JAM_TUTORIAL_BOARD,
  PARKING_JAM_TUTORIAL_PROGRESS_STEP_COUNT,
  type ParkingJamTutorialBoardState,
  type ParkingJamTutorialContactedMove,
  type ParkingJamTutorialRuleId,
  parkingJamTutorial,
} from "@/games/parking-jam/tutorial/tutorial";
import {
  ParkingJamBoard,
  type ParkingJamDeparture,
} from "@/games/parking-jam/ui/board/ParkingJamBoard";
import { ParkingJamGround } from "@/games/parking-jam/ui/ParkingJamGround";
import { ParkingJamHowToPlayDialog } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog";
import {
  ParkingJamTutorialBoardFocus,
  type ParkingJamTutorialFocusTarget,
  type ParkingJamTutorialMark,
} from "@/games/parking-jam/ui/ParkingJamTutorial/ParkingJamTutorialBoardFocus";
import { ParkingJamTutorialGoalScene } from "@/games/parking-jam/ui/ParkingJamTutorial/ParkingJamTutorialGoalScene";
import { useParkingJamSoundEffects } from "@/games/parking-jam/ui/use-parking-jam-sound-effects";
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
import { prefersReducedMotion } from "@/lib/motion";

type ParkingJamTutorialProps = {
  open: boolean;
  /** ゲームのホームから開いたときだけ渡す。 */
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type ParkingJamTutorialProgress = TutorialProgress<
  ParkingJamTutorialRuleId,
  ParkingJamTutorialBoardState
>;

type BoardFocus = {
  spotlights: ParkingJamTutorialFocusTarget[];
  mark: ParkingJamTutorialMark | null;
};

const noFocus: BoardFocus = { spotlights: [], mark: null };

/** `parking-jam-board.css` の出ていく動き（`pj-exit`）の長さ。 */
const EXIT_ANIMATION_MS = 520;

const EXIT_STEP_HOLD_MS = EXIT_ANIMATION_MS + 180;

// 入口のゴールの場面で、盤面が見えきってから車を動かす。
const DEPARTURE_START_MS = 900;
const DEPARTURE_INTERVAL_MS = 300;

const goalDepartures: readonly ParkingJamDeparture[] =
  listParkingJamTutorialSolution().map((move, index) => ({
    ...move,
    delayMs: DEPARTURE_START_MS + index * DEPARTURE_INTERVAL_MS,
  }));

const GOAL_SCENE_MS =
  DEPARTURE_START_MS +
  (goalDepartures.length - 1) * DEPARTURE_INTERVAL_MS +
  EXIT_ANIMATION_MS;

const goalState = parkingJamTutorial.goal().puzzle;

const soundProgresses = {
  intro: "playing",
  playing: "playing",
  // 最後の車が出ていく間を完成演出とする。
  solved: "clearing",
  completed: "result",
} as const satisfies Record<TutorialPhase, GameProgress>;

function createOperation(
  { lastMove }: ParkingJamTutorialBoardState,
  id: number,
): ParkingJamOperation | null {
  return lastMove
    ? {
        id,
        type: lastMove.type,
        vehicleId: lastMove.vehicleId,
        direction: lastMove.direction,
      }
    : null;
}

function listContactedMoveTargets({
  move,
  contact,
}: ParkingJamTutorialContactedMove): ParkingJamTutorialFocusTarget[] {
  const vehicle: ParkingJamTutorialFocusTarget = {
    kind: "vehicle",
    vehicleId: move.vehicleId,
  };
  const { blocker } = contact;
  switch (blocker.kind) {
    case "vehicle":
      return [vehicle, { kind: "vehicle", vehicleId: blocker.vehicleId }];
    case "fixed-area":
      return [vehicle, { kind: "fixed-area", cell: blocker.cell }];
    case "wall":
      return [vehicle, { kind: "curb", move }];
  }
}

export function ParkingJamTutorial({
  open,
  playStart,
  onClose,
}: ParkingJamTutorialProps) {
  const [progress, setProgress] = useState<ParkingJamTutorialProgress>(() =>
    startTutorial(parkingJamTutorial),
  );
  const [operation, setOperation] = useState<ParkingJamOperation | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] =
    useState<ParkingJamVehicleId | null>(null);
  const [hintRequestedProgress, setHintRequestedProgress] =
    useState<ParkingJamTutorialProgress | null>(null);
  // 手を引いている間に印の無い車を触られたら、触られるたびに印の線を短く濃くして戻す。
  // 本番なら出られる手もあるので、揺れや違反の一言は返さず、印へ目を向けさせるだけにする。
  const [recall, setRecall] = useState<{
    progress: ParkingJamTutorialProgress;
    id: number;
  } | null>(null);
  // 操作の `id` は、もう一度始めても前の手と重ならないよう、開いている間通して数える。
  const operationIdRef = useRef(0);
  // 手順どおりの手で次の手順へ進んだときの、進む前の進行。車が出ていき終えて次の印を付けるまで、一言と覆いをこちらで見せる。
  const [steppedHold, setSteppedHold] = useState<{
    progress: ParkingJamTutorialProgress;
    before: ParkingJamTutorialProgress;
  } | null>(null);
  const holdTimerRef = useRef<number | undefined>(undefined);
  const situation = getTutorialSituation(parkingJamTutorial, progress);
  const guiding = situation.step !== null;
  const { boardState } = progress;
  const playing = progress.phase === "playing";
  const holdingStep = steppedHold?.progress === progress;
  const recallId = recall?.progress === progress ? recall.id : null;
  // 進む前の手順で出られなかった手があっても、見届ける間は進む前の手順の一言を見せる。
  const shownProgress =
    holdingStep && steppedHold
      ? { ...steppedHold.before, violated: false }
      : progress;
  const shownSituation = getTutorialSituation(
    parkingJamTutorial,
    shownProgress,
  );
  // 最後の手順の車が出ていく間も手を引いている間とし、出ていき終えて手を離す一言を出すときに覆いを外す。
  const shownGuiding = playing && shownSituation.step !== null;
  // 手を離した後は、自分で解いている間に割り込まないよう、手がかりは求められたときだけ見せ、次の手で消す。
  const hintRequestable = playing && !guiding && !holdingStep;
  const hint =
    hintRequestable && hintRequestedProgress === progress
      ? findParkingJamTutorialHint(boardState)
      : null;
  const stepMove = getParkingJamTutorialStepMove(situation);
  const stepVehicleId = stepMove?.vehicleId ?? null;
  const markTarget =
    !playing || holdingStep
      ? null
      : guiding
        ? stepMove && {
            vehicleId: stepMove.vehicleId,
            swipe: stepMove.direction,
          }
        : hint && { vehicleId: hint.vehicleId, swipe: null };

  useParkingJamSoundEffects(operation, soundProgresses[progress.phase]);

  useEffect(() => {
    return () => window.clearTimeout(holdTimerRef.current);
  }, []);

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  function handleRequestHint(): void {
    setHintRequestedProgress(progress);
  }

  function rejectsOffStepVehicle(vehicleId: ParkingJamVehicleId): boolean {
    if (!guiding || vehicleId === stepVehicleId) {
      return false;
    }
    setRecall((current) => ({
      progress,
      id: current?.progress === progress ? current.id + 1 : 0,
    }));
    return true;
  }

  // 手順の車が出ていく間は、出す前の手順の一言と覆いを見せているので、どの車も受け付けない。
  // 最後の手順では手をもう離しているが、出ていき終えて手を離す一言を出すまでは、決め手として残している車も動かさせない。
  function handleSelectVehicle(vehicleId: ParkingJamVehicleId): void {
    if (!playing || holdingStep || rejectsOffStepVehicle(vehicleId)) {
      return;
    }
    setSelectedVehicleId((current) =>
      current === vehicleId ? null : vehicleId,
    );
  }

  function handleMove(
    vehicleId: ParkingJamVehicleId,
    direction: ParkingJamDirection,
  ): void {
    if (holdingStep) {
      return;
    }
    const next = performTutorialAction(parkingJamTutorial, progress, {
      vehicleId,
      direction,
    });
    if (next === progress) {
      rejectsOffStepVehicle(vehicleId);
      return;
    }
    setProgress(next);
    operationIdRef.current += 1;
    setOperation(createOperation(next.boardState, operationIdRef.current));
    const stepped = next.stepIndex !== progress.stepIndex;
    if (stepped || next.boardState.lastMove?.type === "exited") {
      setSelectedVehicleId(null);
    }
    window.clearTimeout(holdTimerRef.current);
    setSteppedHold(stepped ? { progress: next, before: progress } : null);
    if (stepped) {
      holdTimerRef.current = window.setTimeout(
        () => setSteppedHold(null),
        prefersReducedMotion() ? 0 : EXIT_STEP_HOLD_MS,
      );
    }
  }

  function restart(): void {
    window.clearTimeout(holdTimerRef.current);
    setHintRequestedProgress(null);
    setRecall(null);
    setSteppedHold(null);
    setOperation(null);
    setSelectedVehicleId(null);
    setProgress(startTutorial(parkingJamTutorial));
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

  const finish: TutorialFinish = playStart
    ? {
        entry: "home",
        difficulty: playStart.difficulty,
        onStartPlay: handleStartPlay,
      }
    : { entry: "play", onReturnToPlay: handleClose };

  /**
   * 車が出ていく間は、動かす前の一言を残す。次の手順の一言は次の印と一緒に、完成の一言は最後の車が出ていき終えてから出す。
   * 印の線を濃くし直したときと、手がかりを出したときは、前の違反の一言を下げて、
   * 印の車へ向かう手順の一言か、手がかりの一言に戻す。
   */
  function getMessage(): TutorialMessage {
    if (progress.phase === "solved") {
      return parkingJamTutorial.freePlay;
    }
    if (hint) {
      return describeParkingJamTutorialHint(hint);
    }
    if (recallId !== null) {
      return situation.step?.message ?? parkingJamTutorial.freePlay;
    }
    return getTutorialMessage(parkingJamTutorial, shownProgress, {
      entry: finish.entry,
      // 1回のスワイプで決まる手なので、一瞬だけ違反になる途中の状態は無い。
      violationSettled: true,
    });
  }

  /**
   * 覆いの中で元の明るさで残す物。
   * - 手を引く間は、印の車と決め手。操作を教える手順には決め手が無いので覆わない。
   *   車が出ていく間は、出す前の手順のまま残す。出られない手をしたら、揺れとわけの一言が指す、その車とぶつかったものも残す。
   * - 手を離した後に出られない手をしたら、その車とぶつかったものと、一言が先に出すよう言う車（直す所）。
   * - 手がかりを出している間は、手がかりの車と、その車を出すと通れるようになる車。
   */
  function getSpotlights(): ParkingJamTutorialFocusTarget[] {
    if (hint?.clearedMove) {
      return [
        { kind: "vehicle", vehicleId: hint.vehicleId },
        ...listContactedMoveTargets(hint.clearedMove),
      ];
    }
    const { lastMove } = boardState;
    const blockedTargets =
      lastMove?.type === "blocked"
        ? listContactedMoveTargets({
            move: lastMove,
            contact: lastMove.contact,
          })
        : [];
    const step = shownSituation.step;
    if (!shownGuiding || step === null) {
      if (
        !playing ||
        hint ||
        !progress.violated ||
        lastMove?.type !== "blocked"
      ) {
        return [];
      }
      const fixVehicleIds =
        lastMove.fix?.kind === "clear" ? lastMove.fix.vehicleIds : [];
      return [
        ...blockedTargets,
        ...fixVehicleIds.map(
          (vehicleId): ParkingJamTutorialFocusTarget => ({
            kind: "vehicle",
            vehicleId,
          }),
        ),
      ];
    }
    const decider = findParkingJamTutorialDecider(
      shownSituation,
      shownProgress.boardState,
    );
    if (decider === null) {
      return [];
    }
    return [
      { kind: "vehicle", vehicleId: step.vehicleId },
      ...listContactedMoveTargets(decider),
      ...listParkingJamTutorialStepContacts(
        shownSituation,
        shownProgress.boardState,
      ).flatMap(listContactedMoveTargets),
      ...blockedTargets,
    ];
  }

  const spotlights = playing ? getSpotlights() : [];

  function getBoardFocus(): BoardFocus {
    return {
      spotlights,
      mark: markTarget && { ...markTarget, recallId },
    };
  }

  function renderParkingJamBoard(
    showsGoal: boolean,
    departing: boolean,
    { spotlights: shownSpotlights, mark }: BoardFocus,
    solving: boolean,
  ) {
    return (
      <div className="flex size-full items-center justify-center">
        <ParkingJamTutorialBoardFocus
          board={PARKING_JAM_TUTORIAL_BOARD}
          spotlights={shownSpotlights}
          mark={mark}
        >
          <ParkingJamBoard
            board={PARKING_JAM_TUTORIAL_BOARD}
            state={showsGoal ? goalState : boardState.puzzle}
            selectedVehicleId={solving ? selectedVehicleId : null}
            operation={solving ? operation : null}
            departures={departing ? goalDepartures : []}
            interactionDisabled={!playing || !solving}
            // 演出を終えた後も出ていった車を消したままにするため、解き終えた後は演出を止めずにおく。
            clearing={
              progress.phase === "solved" || progress.phase === "completed"
            }
            onSelectVehicle={handleSelectVehicle}
            onMove={handleMove}
            onClearAnimationComplete={handleClearAnimationComplete}
          />
        </ParkingJamTutorialBoardFocus>
      </div>
    );
  }

  function renderBoard({
    scene,
    playing: scenePlaying,
    onSceneEnd,
  }: TutorialStageBoardIntro) {
    if (scene === "goal") {
      return (
        <ParkingJamTutorialGoalScene
          durationMs={GOAL_SCENE_MS}
          playing={scenePlaying}
          onSceneEnd={onSceneEnd}
        >
          {(departing) =>
            renderParkingJamBoard(true, departing, noFocus, false)
          }
        </ParkingJamTutorialGoalScene>
      );
    }
    const boardFocus = scene === null ? getBoardFocus() : noFocus;
    return (
      <TutorialCrossFadeIntroScene
        scene={scene}
        playing={scenePlaying}
        onSceneEnd={onSceneEnd}
      >
        {(showsGoal) =>
          renderParkingJamBoard(
            showsGoal,
            false,
            showsGoal ? noFocus : boardFocus,
            scene === null,
          )
        }
      </TutorialCrossFadeIntroScene>
    );
  }

  return (
    <TutorialOverlay
      presentation="stage"
      open={open}
      title={PARKING_JAM_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      background={<ParkingJamGround />}
      intro={parkingJamTutorial.intro}
      recap={parkingJamTutorial.rules.map((rule) => rule.label)}
      message={getMessage()}
      phase={progress.phase}
      spotlighting={spotlights.length > 0}
      progress={
        progress.phase === "solved" || progress.phase === "completed"
          ? 1
          : getParkingJamTutorialProgressRatio(boardState)
      }
      progressStepCount={PARKING_JAM_TUTORIAL_PROGRESS_STEP_COUNT}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={handleRestart}
      renderHowToPlayDialog={(control) => (
        <ParkingJamHowToPlayDialog {...control} />
      )}
      onRequestHint={
        hintRequestable && hint === null ? handleRequestHint : null
      }
      onClose={handleClose}
    />
  );
}
