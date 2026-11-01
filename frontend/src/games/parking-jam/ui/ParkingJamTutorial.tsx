import { useCallback, useEffect, useRef, useState } from "react";

import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
} from "@/components/TutorialOverlay";
import pictogramSvg from "@/games/parking-jam/assets/pictogram.svg?raw";
import { PARKING_JAM_DISPLAY_NAME } from "@/games/parking-jam/display-name";
import type { ParkingJamOperation } from "@/games/parking-jam/play/use-parking-jam-play";
import type {
  ParkingJamDirection,
  ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import {
  findParkingJamTutorialContact,
  findParkingJamTutorialHintVehicle,
  getParkingJamTutorialStepVehicle,
  listParkingJamTutorialSolution,
  PARKING_JAM_TUTORIAL_BOARD,
  type ParkingJamTutorialBoardState,
  type ParkingJamTutorialRuleId,
  parkingJamTutorial,
} from "@/games/parking-jam/tutorial/tutorial";
import type {
  ParkingJamContactCue,
  ParkingJamVehicleCue,
} from "@/games/parking-jam/ui/board/board-cue";
import {
  ParkingJamBoard,
  type ParkingJamDeparture,
} from "@/games/parking-jam/ui/board/ParkingJamBoard";
import { ParkingJamTutorialIntroScene } from "@/games/parking-jam/ui/ParkingJamTutorial/ParkingJamTutorialIntroScene";
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
import { prefersReducedMotion } from "@/lib/motion";

type ParkingJamTutorialProps = {
  open: boolean;
  /** 難易度選択から開いたときに渡す。終えたときにレベル1を始める操作を出す。渡さなければプレイ中に開いたとして、閉じてプレイに戻る操作を出す。 */
  onStartPlay?: () => void;
  onClose: () => void;
};

type ParkingJamTutorialProgress = TutorialProgress<
  ParkingJamTutorialRuleId,
  ParkingJamTutorialBoardState
>;

type BoardCues = {
  cues: ParkingJamVehicleCue[];
  contacts: ParkingJamContactCue[];
};

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

const PARKED_VEHICLE_IDS = PARKING_JAM_TUTORIAL_BOARD.vehicles.map(
  ({ id }) => id,
);

/** 導入のゴールの場面で、始めの盤面の車を解き方の順に1台ずつ出していき、空の駐車場にする。 */
const goalDepartures: readonly ParkingJamDeparture[] =
  listParkingJamTutorialSolution().map((move, index) => ({
    ...move,
    delayMs: DEPARTURE_START_MS + index * DEPARTURE_INTERVAL_MS,
  }));

/** 車がすべて出ていき終えてから、停まっていた場所の点線を浮かび上がらせる。 */
const GOAL_GHOST_DELAY_MS =
  DEPARTURE_START_MS +
  (goalDepartures.length - 1) * DEPARTURE_INTERVAL_MS +
  EXIT_ANIMATION_MS;

const goalState = parkingJamTutorial.goal().puzzle;

/** 直前の手を、本番の盤面と同じ出ていく動きや、当たる動きにする。 */
function createOperation({
  lastMove,
  moveCount,
}: ParkingJamTutorialBoardState): ParkingJamOperation | null {
  return lastMove
    ? {
        id: moveCount,
        type: lastMove.type,
        vehicleId: lastMove.vehicleId,
        direction: lastMove.direction,
      }
    : null;
}

/**
 * 出られなかった手には、車の縁の警告の色と、まっすぐ進む先と当たったものの合図で返す。
 * 動きを減らす設定で当たる動きが見えないときも、出られなかったことと、何に当たったかが盤面で伝わる。
 */
function getRejectedCues({
  lastMove,
  moveCount,
}: ParkingJamTutorialBoardState): BoardCues {
  if (lastMove?.type !== "blocked") {
    return { cues: [], contacts: [] };
  }
  return {
    cues: [{ vehicleId: lastMove.vehicleId, kind: "rejected", id: moveCount }],
    contacts: [
      {
        move: lastMove,
        contact: lastMove.contact,
        tone: "rejected",
        id: moveCount,
      },
    ],
  };
}

/**
 * 7台の駐車場で、一言と印に沿って1台ずつ出させ、出られない向きのわけを1つずつ示す。
 * 手順を終えたら手を離し、残りを自分で出させる。盤面と出ていく動きは本番と同じ部品を使う。
 */
export function ParkingJamTutorial({
  open,
  onStartPlay,
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
  // 手を引いている間に印の無い車を触ったら、その車の縁を一瞬警告の色にし、印を付け直して光らせる。
  const [offStepTouch, setOffStepTouch] = useState<{
    vehicleId: ParkingJamVehicleId;
    id: number;
  } | null>(null);
  const [hintCueId, setHintCueId] = useState(0);
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
  // 進む前の手順で出られなかった手があっても、見届ける間は進む前の手順の一言を見せる。
  const shownProgress =
    holdingStep && steppedHold
      ? { ...steppedHold.before, violated: false }
      : progress;
  const shownSituation = getTutorialSituation(
    parkingJamTutorial,
    shownProgress,
  );
  const stepVehicleId = getParkingJamTutorialStepVehicle(situation);
  const hintVehicleId =
    !playing || holdingStep
      ? null
      : guiding
        ? stepVehicleId
        : idleHintShown
          ? findParkingJamTutorialHintVehicle(boardState)
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

  useEffect(() => {
    return () => window.clearTimeout(holdTimerRef.current);
  }, []);

  const handleClearAnimationComplete = useCallback(() => {
    setProgress(completeTutorial);
  }, []);

  function handleIntroEnd(): void {
    setProgress(finishTutorialIntro);
  }

  /** 手を引いている間に印の無い車を触ったら、受け付けずに、その車の縁と印で応える。 */
  function rejectsOffStepVehicle(vehicleId: ParkingJamVehicleId): boolean {
    if (!guiding || vehicleId === stepVehicleId) {
      return false;
    }
    setHintCueId((id) => id + 1);
    setOffStepTouch((current) => ({ vehicleId, id: (current?.id ?? 0) + 1 }));
    return true;
  }

  function handleSelectVehicle(vehicleId: ParkingJamVehicleId): void {
    if (!playing || rejectsOffStepVehicle(vehicleId)) {
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
    const next = performTutorialAction(parkingJamTutorial, progress, {
      vehicleId,
      direction,
    });
    if (next === progress) {
      rejectsOffStepVehicle(vehicleId);
      return;
    }
    setProgress(next);
    setOperation(createOperation(next.boardState));
    setOffStepTouch(null);
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
    setSteppedHold(null);
    setOperation(null);
    setSelectedVehicleId(null);
    setOffStepTouch(null);
    setProgress(startTutorial(parkingJamTutorial));
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
   * 車が出ていく間は、動かす前の一言を残す。次の手順の一言は次の印と一緒に、完成の一言は最後の車が出ていき終えてから出す。
   * 手を離した後に止まって印が出たら、前の違反の一言は下げて、残りを出す一言に戻す。
   */
  function getMessage(): TutorialMessage {
    if (
      progress.phase === "solved" ||
      (idleHintShown && hintVehicleId !== null)
    ) {
      return parkingJamTutorial.freePlay;
    }
    return getTutorialMessage(parkingJamTutorial, shownProgress, {
      entry: finish.entry,
      // 1回のスワイプで決まる手なので、一瞬だけ違反になる途中の状態は無い。
      violationSettled: true,
    });
  }

  /**
   * 印と、手の結果の合図。導入の終わりは、最初の手順の一言を出すのと同時に、最初の印を付ける。
   * 印の車にほかの車が塞がれていれば、印と一緒に、塞がれた車の進む先と当たる所を示す。
   */
  function getCues(messageShown: boolean): BoardCues {
    const cueVehicleId =
      progress.phase === "intro"
        ? messageShown
          ? stepVehicleId
          : null
        : hintVehicleId;
    const rejected = getRejectedCues(boardState);
    const touched: ParkingJamVehicleCue[] = offStepTouch
      ? [
          {
            vehicleId: offStepTouch.vehicleId,
            kind: "rejected",
            id: -offStepTouch.id,
          },
        ]
      : [];
    const hint: ParkingJamVehicleCue[] =
      cueVehicleId === null
        ? []
        : [{ vehicleId: cueVehicleId, kind: "hint", id: hintCueId }];
    const waitingMove =
      cueVehicleId !== null ? (situation.step?.waitingMove ?? null) : null;
    const waitingContact =
      waitingMove &&
      findParkingJamTutorialContact(boardState.puzzle, waitingMove);
    const waiting: ParkingJamContactCue[] =
      waitingMove && waitingContact
        ? [
            {
              move: waitingMove,
              contact: waitingContact,
              tone: "waiting",
              id: 0,
            },
          ]
        : [];
    return {
      cues: [...hint, ...rejected.cues, ...touched],
      contacts: [...waiting, ...rejected.contacts],
    };
  }

  /**
   * 導入のゴールの場面では、始めの盤面の車を1台ずつ出していって空の駐車場を見せ、停まっていた場所を点線で残す。
   * 動きを減らす設定では、空の駐車場と点線をすぐ見せる。始めの盤面の場面で、車の停まった始めの盤面へ替える。
   */
  function renderBoard({
    scene,
    playing: scenePlaying,
    onSceneEnd,
    messageShown,
  }: TutorialBoardIntro) {
    const departing = scene === "goal" && !prefersReducedMotion();
    const { cues, contacts } =
      scene === null ? getCues(messageShown) : { cues: [], contacts: [] };
    return (
      <ParkingJamTutorialIntroScene
        scene={scene}
        playing={scenePlaying}
        onSceneEnd={onSceneEnd}
      >
        {(showsGoal) => (
          <div className="flex size-full items-center justify-center">
            <ParkingJamBoard
              board={PARKING_JAM_TUTORIAL_BOARD}
              state={showsGoal ? goalState : boardState.puzzle}
              selectedVehicleId={scene === null ? selectedVehicleId : null}
              operation={scene === null ? operation : null}
              cues={cues}
              contacts={contacts}
              bumpsToContact
              departures={showsGoal && departing ? goalDepartures : []}
              ghostVehicleIds={showsGoal ? PARKED_VEHICLE_IDS : []}
              ghostDelayMs={showsGoal && departing ? GOAL_GHOST_DELAY_MS : 0}
              interactionDisabled={!playing}
              // 演出を終えた後も出ていった車を消したままにするため、解き終えた後は演出を止めずにおく。
              clearing={
                progress.phase === "solved" || progress.phase === "completed"
              }
              onSelectVehicle={handleSelectVehicle}
              onMove={handleMove}
              onClearAnimationComplete={handleClearAnimationComplete}
            />
          </div>
        )}
      </ParkingJamTutorialIntroScene>
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
