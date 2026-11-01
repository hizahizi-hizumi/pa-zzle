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
  findParkingJamTutorialHintVehicle,
  getParkingJamTutorialStepVehicle,
  PARKING_JAM_TUTORIAL_BOARD,
  type ParkingJamTutorialBoardState,
  type ParkingJamTutorialRuleId,
  parkingJamTutorial,
} from "@/games/parking-jam/tutorial/tutorial";
import { ParkingJamBoard } from "@/games/parking-jam/ui/board/ParkingJamBoard";
import type { ParkingJamVehicleCue } from "@/games/parking-jam/ui/board/vehicle-cue";
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

/** `parking-jam-board.css` の出ていく動き（`pj-exit`）の長さ。車が出ていき終えてから次の手順の一言と印を出す。 */
const EXIT_STEP_HOLD_MS = 520;

/** 車が当たって止まるのと、縁の警告の色が消えていくのを見届けてから、次の手順の一言と印を出すまでの間。 */
const BLOCKED_STEP_HOLD_MS = 800;

/** 手を離した後、手が止まってから今出せる車を示すまでの間。 */
const IDLE_HINT_DELAY_MS = 4000;

const goalState = parkingJamTutorial.goal().puzzle;

/** 直前の手を、本番の盤面と同じ出ていく動き・当たって止まる動きにする。 */
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

/** 出られなかった車は、当たって止まる動きに加えて縁の色でも返す。動きを減らす設定で動かないときも、出られなかったことが伝わる。 */
function getRejectedCues({
  lastMove,
  moveCount,
}: ParkingJamTutorialBoardState): ParkingJamVehicleCue[] {
  return lastMove?.type === "blocked"
    ? [{ vehicleId: lastMove.vehicleId, kind: "rejected", id: moveCount }]
    : [];
}

/**
 * 7台の駐車場で、一言と印に沿って1台ずつ出させ、出られない向きを1つずつ体験させる。
 * 手順を終えたら手を離し、残りを自分で出させる。盤面・出ていく動き・当たって止まる動きは本番と同じ部品を使う。
 */
export function ParkingJamTutorial({
  open,
  onStartPlay,
  onClose,
}: ParkingJamTutorialProps) {
  const [progress, setProgress] = useState<ParkingJamTutorialProgress>(() =>
    startTutorial(parkingJamTutorial),
  );
  // 盤面の動き。手のたびにイベントハンドラで作り、盤面が出ていく動きや当たって止まる動きで応える。
  const [operation, setOperation] = useState<ParkingJamOperation | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] =
    useState<ParkingJamVehicleId | null>(null);
  const [idleProgress, setIdleProgress] =
    useState<ParkingJamTutorialProgress | null>(null);
  // 手を引いている間に印の無い車を動かそうとしたら、印を付け直す。
  const [hintCueId, setHintCueId] = useState(0);
  // 手順どおりの手で次の手順へ進んだときの、進む前の進行。盤面の動きを見届けて次の印を付けるまで、一言とルールの並びをこちらで見せる。
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

  /** 手を引いている間に印の無い車を触ったら、受け付けずに印を付け直す。 */
  function rejectsOffStepVehicle(vehicleId: ParkingJamVehicleId): boolean {
    if (!guiding || vehicleId === stepVehicleId) {
      return false;
    }
    setHintCueId((id) => id + 1);
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
    if (next.boardState.lastMove?.type === "exited") {
      setSelectedVehicleId(null);
    }
    window.clearTimeout(holdTimerRef.current);
    const stepped = next.stepIndex !== progress.stepIndex;
    setSteppedHold(stepped ? { progress: next, before: progress } : null);
    if (stepped) {
      const holdMs =
        next.boardState.lastMove?.type === "blocked"
          ? BLOCKED_STEP_HOLD_MS
          : prefersReducedMotion()
            ? 0
            : EXIT_STEP_HOLD_MS;
      holdTimerRef.current = window.setTimeout(
        () => setSteppedHold(null),
        holdMs,
      );
    }
  }

  function restart(): void {
    window.clearTimeout(holdTimerRef.current);
    setIdleProgress(null);
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
    onStartPlay?.();
  }

  const finish: TutorialFinish = onStartPlay
    ? { entry: "selection", onStartPlay: handleStartPlay }
    : { entry: "play", onReturnToPlay: handleClose };

  /**
   * 盤面が動いている間は、動かす前の一言を残し、次の手順の一言は次の印と一緒に出す。
   * 手を離した後に止まって印が出たら、前の違反の一言は下げて、残りを出す一言に戻す。
   */
  function getMessage(): TutorialMessage {
    if (idleHintShown && hintVehicleId !== null) {
      return parkingJamTutorial.freePlay;
    }
    return getTutorialMessage(parkingJamTutorial, shownProgress, {
      entry: finish.entry,
      // 1回のスワイプで決まる手なので、一瞬だけ違反になる途中の状態は無い。
      violationSettled: true,
    });
  }

  /** 導入の終わりは、最初の手順の一言を出すのと同時に、最初の印を付ける。 */
  function getCues(messageShown: boolean): ParkingJamVehicleCue[] {
    const cueVehicleId =
      progress.phase === "intro"
        ? messageShown
          ? stepVehicleId
          : null
        : hintVehicleId;
    const cues = getRejectedCues(boardState);
    return cueVehicleId === null
      ? cues
      : [...cues, { vehicleId: cueVehicleId, kind: "hint", id: hintCueId }];
  }

  /** 導入の間は空の駐車場を見せ、始めの盤面の場面で、車の停まった始めの盤面へ替える。 */
  function renderBoard({
    scene,
    playing: scenePlaying,
    onSceneEnd,
    messageShown,
  }: TutorialBoardIntro) {
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
              cues={scene === null ? getCues(messageShown) : []}
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
