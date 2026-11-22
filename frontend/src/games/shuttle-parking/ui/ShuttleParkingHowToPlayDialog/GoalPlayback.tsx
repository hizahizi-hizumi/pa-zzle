import { useCallback, useEffect, useState } from "react";
import { HowToPlayGoalFrame } from "@/components/HowToPlayGoalFrame";
import { createShuttleParkingExitTimeline } from "@/games/shuttle-parking/play/exit-timeline";
import type { ShuttleParkingOperation } from "@/games/shuttle-parking/play/use-shuttle-parking-play";
import {
  createShuttleParkingInitialState,
  exitShuttleParkingCar,
  type ShuttleParkingState,
} from "@/games/shuttle-parking/puzzle/rules";
import { shuttleParkingTutorialProblem } from "@/games/shuttle-parking/tutorial/tutorial";
import { ShuttleParkingScene } from "@/games/shuttle-parking/ui/board/ShuttleParkingScene";
import { prefersReducedMotion } from "@/lib/motion";

/** 始まりの盤面を見せておく間。列と車の色を見比べられる長さにする。 */
const GOAL_START_HOLD_MS = 1500;

/** チュートリアルで解く1枚を、先頭の乗客が乗れる車から出していく順。 */
const goalOrder = [3, 1, 0, 2] as const;

type GoalStep = {
  state: ShuttleParkingState;
  operation: Omit<
    Extract<ShuttleParkingOperation, { type: "exited" }>,
    "id" | "startedAt"
  > | null;
};

const goalSteps: readonly GoalStep[] = listGoalSteps();

function listGoalSteps(): GoalStep[] {
  let state = createShuttleParkingInitialState(shuttleParkingTutorialProblem);
  const steps: GoalStep[] = [{ state, operation: null }];
  for (const carId of goalOrder) {
    const exit = exitShuttleParkingCar(
      shuttleParkingTutorialProblem,
      state,
      carId,
    );
    if (exit.outcome !== "exited") {
      throw new Error(`Goal car ${carId} must exit`);
    }
    steps.push({
      state: exit.state,
      operation: {
        type: "exited",
        carId,
        side: exit.side,
        timeline: createShuttleParkingExitTimeline(state, carId, exit.events),
      },
    });
    state = exit.state;
  }
  return steps;
}

const lastStep = goalSteps.length - 1;

/** 次の車を出すまでの間。前の車の乗車と出発を見せ終えてから出す。 */
function getStepDelayMs(step: number): number {
  const operation = goalSteps[step]?.operation;
  return (operation?.timeline.durationMs ?? 0) + 300;
}

/**
 * 入口のゴールの盤面。開いたときに1回、チュートリアルと同じ1枚を、本番と同じ動きで1台ずつ出して全員を送り出し、
 * 空になった駐車場で終える。音は鳴らさない。途中で飛ばすと空の駐車場をすぐ見せ、出し終えた後だけ見せ直せる。
 * 動きを減らす設定では、始まりの盤面を短く見せてから、空の駐車場を動かさずに見せる。
 */
export function GoalPlayback() {
  const [playCount, setPlayCount] = useState(0);
  const [step, setStep] = useState(0);
  const [stepStartedAt, setStepStartedAt] = useState(0);
  const [settled, setSettled] = useState(false);

  const skipToGoal = useCallback(() => {
    setStep(lastStep);
    setStepStartedAt(0);
    setSettled(true);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 見せ直した回数は、刻み直す合図としてだけ使う
  useEffect(() => {
    if (settled) return;
    const timers: number[] = [];
    if (prefersReducedMotion()) {
      timers.push(window.setTimeout(skipToGoal, GOAL_START_HOLD_MS));
    } else {
      let atMs = GOAL_START_HOLD_MS;
      for (let next = 1; next <= lastStep; next += 1) {
        timers.push(
          window.setTimeout(() => {
            setStep(next);
            setStepStartedAt(Date.now());
          }, atMs),
        );
        atMs += getStepDelayMs(next);
      }
      timers.push(window.setTimeout(() => setSettled(true), atMs));
    }
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [playCount, settled, skipToGoal]);

  function replay() {
    setStep(0);
    setSettled(false);
    setPlayCount((count) => count + 1);
  }

  const shown = goalSteps[step] ?? goalSteps[0]!;
  return (
    <HowToPlayGoalFrame
      board={
        <div role="img" aria-label="ゴールの盤面" className="w-56">
          <ShuttleParkingScene
            problem={shuttleParkingTutorialProblem}
            state={shown.state}
            operation={
              shown.operation === null || stepStartedAt === 0
                ? null
                : {
                    ...shown.operation,
                    id: playCount * goalSteps.length + step,
                    startedAt: stepStartedAt,
                  }
            }
            interactionDisabled
            onExitCar={() => {}}
            layout="figure"
          />
        </div>
      }
      skippable={!settled}
      skipLabel="全員を送り出した姿まで飛ばす"
      onSkip={skipToGoal}
      replayable={settled}
      onReplay={replay}
    />
  );
}

export const _private = { goalSteps, GOAL_START_HOLD_MS };
