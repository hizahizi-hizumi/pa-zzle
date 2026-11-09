import { useCallback, useEffect, useRef, useState } from "react";
import { TutorialCrossFadeIntroScene } from "@/components/TutorialCrossFadeIntroScene";
import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
  type TutorialPlayStart,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/parking-jam/assets/pictogram.svg?raw";
import { PARKING_JAM_DISPLAY_NAME } from "@/games/parking-jam/display-name";
import type { ParkingJamOperation } from "@/games/parking-jam/play/use-parking-jam-play";
import type {
  ParkingJamDirection,
  ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import {
  findParkingJamTutorialDecider,
  findParkingJamTutorialHintVehicle,
  getParkingJamTutorialStepVehicle,
  listParkingJamTutorialSolution,
  PARKING_JAM_TUTORIAL_BOARD,
  type ParkingJamTutorialBoardState,
  type ParkingJamTutorialContactedMove,
  type ParkingJamTutorialRuleId,
  parkingJamTutorial,
} from "@/games/parking-jam/tutorial/tutorial";
import {
  ParkingJamBoard,
  type ParkingJamDeparture,
} from "@/games/parking-jam/ui/board/ParkingJamBoard";
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
  /** ゲームのホームから開いたときに渡す。終えたときに、ゲームのホームで開いているレベルを始める操作を出す。渡さなければプレイ中に開いたとして、閉じてプレイに戻る操作を出す。 */
  playStart?: TutorialPlayStart;
  onClose: () => void;
};

type ParkingJamTutorialProgress = TutorialProgress<
  ParkingJamTutorialRuleId,
  ParkingJamTutorialBoardState
>;

/** 盤面に重ねる、覆いから抜く物と印。 */
type BoardFocus = {
  spotlights: ParkingJamTutorialFocusTarget[];
  mark: ParkingJamTutorialMark | null;
};

const noFocus: BoardFocus = { spotlights: [], mark: null };

/** `parking-jam-board.css` の出ていく動き（`pj-exit`）の長さ。 */
const EXIT_ANIMATION_MS = 520;

/** 車が出ていき終えて盤面から消えてから、次の手順の一言と印を出すまでの間。 */
const EXIT_STEP_HOLD_MS = EXIT_ANIMATION_MS + 180;

/** 手を離した後、手が止まってから今出せる車を示すまでの間。 */
const IDLE_HINT_DELAY_MS = 4000;

/** 導入のゴールの場面で、盤面を描き始めてから最初の車が出ていき始めるまでの間。盤面が見えきってから動かす。 */
const DEPARTURE_START_MS = 900;
/** 導入のゴールの場面で、車を1台ずつ出していく間隔。 */
const DEPARTURE_INTERVAL_MS = 300;

/** 導入のゴールの場面で、始めの盤面の車を解き方の順に1台ずつ出していき、空の駐車場にする。 */
const goalDepartures: readonly ParkingJamDeparture[] =
  listParkingJamTutorialSolution().map((move, index) => ({
    ...move,
    delayMs: DEPARTURE_START_MS + index * DEPARTURE_INTERVAL_MS,
  }));

/** 導入のゴールの場面で、盤面を描き始めてから、最後の車が出ていき終えるまでの間。 */
const GOAL_SCENE_MS =
  DEPARTURE_START_MS +
  (goalDepartures.length - 1) * DEPARTURE_INTERVAL_MS +
  EXIT_ANIMATION_MS;

const goalState = parkingJamTutorial.goal().puzzle;

/** 本番のプレイ画面と同じ効果音を鳴らすための進行。最後の車が出ていく間を完成演出とする。 */
const soundProgresses = {
  intro: "playing",
  playing: "playing",
  solved: "clearing",
  completed: "result",
} as const satisfies Record<TutorialPhase, GameProgress>;

/**
 * 直前の手を、本番の盤面と同じ出ていく動きや、当たって揺れる動きにする。
 * `id` は、もう一度始めても前の手と重ならないよう、開いている間通して数える。
 */
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

/** 出られない手の車と、その手で当たったもの（ほかの車・植え込み・道路につながっていない外周の縁石）。 */
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

/**
 * 7台の駐車場で、一言と印に沿って1台ずつ出させ、出られない向きのわけを1つずつ示す。
 * 手順を終えたら手を離し、残りを自分で出させる。盤面・出ていく動き・当たって揺れる動きは本番と同じ部品を使う。
 */
export function ParkingJamTutorial({
  open,
  playStart,
  onClose,
}: ParkingJamTutorialProps) {
  const [progress, setProgress] = useState<ParkingJamTutorialProgress>(() =>
    startTutorial(parkingJamTutorial),
  );
  // 盤面の動き。手のたびにイベントハンドラで作り、盤面が出ていく動きや当たる動きで応える。
  const [operation, setOperation] = useState<ParkingJamOperation | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] =
    useState<ParkingJamVehicleId | null>(null);
  const [idleProgress, setIdleProgress] =
    useState<ParkingJamTutorialProgress | null>(null);
  // 手を引いている間に印の無い車を触られたら、触られるたびに印の線を短く濃くして戻す。
  // 本番なら出られる手もあるので、揺れや違反の一言は返さず、印へ目を向けさせるだけにする。
  const [recall, setRecall] = useState<{
    progress: ParkingJamTutorialProgress;
    id: number;
  } | null>(null);
  const operationIdRef = useRef(0);
  // 手順どおりの手で次の手順へ進んだときの、進む前の進行。車が出ていき終えて次の印を付けるまで、一言とルールの並びをこちらで見せる。
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
  const idleHintShown = playing && !guiding && idleProgress === progress;
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
  const stepVehicleId = getParkingJamTutorialStepVehicle(situation);
  const hintVehicleId =
    !playing || holdingStep
      ? null
      : guiding
        ? stepVehicleId
        : idleHintShown
          ? findParkingJamTutorialHintVehicle(boardState)
          : null;

  useParkingJamSoundEffects(operation, soundProgresses[progress.phase]);

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
    return () => window.clearTimeout(holdTimerRef.current);
  }, []);

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  /** 手を引いている間に印の無い車を触ったら、受け付けずに印の線を濃くし直す。 */
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
  // 最後の手順では手をもう離しているが、出ていき終えて手を離す一言を出すまでは、決め手として抜いている車も動かさせない。
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
    setIdleProgress(null);
    setRecall(null);
    setSteppedHold(null);
    setOperation(null);
    setSelectedVehicleId(null);
    setProgress(startTutorial(parkingJamTutorial));
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
   * 車が出ていく間は、動かす前の一言を残す。次の手順の一言は次の印と一緒に、完成の一言は最後の車が出ていき終えてから出す。
   * 印の線を濃くし直したときと、手を離した後に止まって印が出たときは、前の違反の一言を下げて、
   * 印の車へ向かう手順の一言か、残りを出す一言に戻す。
   */
  function getMessage(): TutorialMessage {
    if (
      progress.phase === "solved" ||
      (idleHintShown && hintVehicleId !== null)
    ) {
      return parkingJamTutorial.freePlay;
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
   * 手を引いている間に、画面全体の覆いから抜いて元の明るさで見せる物。
   * - 印の車と、その手を決める物（手順で示すルールで出られない手の車と、その手で当たるもの）。車が出ていく間は、出す前の手順のまま抜く。
   * - 出られない手をしたら、揺れとわけの一言が指す、その車と当たったもの。
   */
  function getSpotlights(): ParkingJamTutorialFocusTarget[] {
    const step = shownSituation.step;
    if (!shownGuiding || step === null) {
      return [];
    }
    const decider = findParkingJamTutorialDecider(
      shownSituation,
      shownProgress.boardState,
    );
    const { lastMove } = boardState;
    return [
      { kind: "vehicle", vehicleId: step.vehicleId },
      ...(decider ? listContactedMoveTargets(decider) : []),
      ...(lastMove?.type === "blocked"
        ? listContactedMoveTargets({
            move: lastMove,
            contact: lastMove.contact,
          })
        : []),
    ];
  }

  /** 印と、覆いから抜く物。導入の終わりは、最初の手順の一言を出すのと同時に、最初の印を付ける。 */
  function getBoardFocus(messageShown: boolean): BoardFocus {
    const markVehicleId =
      progress.phase === "intro"
        ? messageShown
          ? stepVehicleId
          : null
        : hintVehicleId;
    return {
      spotlights: getSpotlights(),
      mark:
        markVehicleId === null ? null : { vehicleId: markVehicleId, recallId },
    };
  }

  function renderParkingJamBoard(
    showsGoal: boolean,
    departing: boolean,
    { spotlights, mark }: BoardFocus,
    solving: boolean,
  ) {
    return (
      <div className="flex size-full items-center justify-center">
        <ParkingJamTutorialBoardFocus
          board={PARKING_JAM_TUTORIAL_BOARD}
          spotlights={spotlights}
          mark={mark}
        >
          <ParkingJamBoard
            board={PARKING_JAM_TUTORIAL_BOARD}
            state={showsGoal ? goalState : boardState.puzzle}
            selectedVehicleId={solving ? selectedVehicleId : null}
            operation={solving ? operation : null}
            departures={departing ? goalDepartures : []}
            interactionDisabled={!playing}
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

  /**
   * 導入のゴールの場面では、始めの盤面の車を1台ずつ出していって空の駐車場を見せる。
   * 動きを減らす設定や、場面の動きを終えたときは、空の駐車場をすぐ見せる。
   * 始めの盤面の場面で、空の駐車場を薄くしながら、車の停まった始めの盤面を浮かび上がらせる。
   */
  function renderBoard({
    scene,
    playing: scenePlaying,
    onSceneEnd,
    messageShown,
  }: TutorialBoardIntro) {
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
    const boardFocus = scene === null ? getBoardFocus(messageShown) : noFocus;
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
      open={open}
      title={PARKING_JAM_DISPLAY_NAME}
      pictogramSvg={pictogramSvg}
      intro={parkingJamTutorial.intro}
      rules={parkingJamTutorial.rules.map((rule) => ({
        ...rule,
        earned: shownProgress.earnedRuleIds.includes(rule.id),
        current: shownSituation.step?.introducedRuleId === rule.id,
      }))}
      message={getMessage()}
      phase={progress.phase}
      guiding={shownGuiding}
      finish={finish}
      renderBoard={renderBoard}
      onIntroEnd={handleIntroEnd}
      onRestart={restart}
      onClose={handleClose}
    />
  );
}
