import { useCallback, useEffect, useState } from "react";

import {
  HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX,
  HowToPlayGoalFrame,
} from "@/components/HowToPlayGoalFrame";
import type { ParkingJamOperation } from "@/games/parking-jam/play/use-parking-jam-play";
import {
  createParkingJamInitialState,
  type ParkingJamState,
} from "@/games/parking-jam/puzzle/board";
import { applyParkingJamMove } from "@/games/parking-jam/puzzle/rules";
import { goalFigure } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/figure-boards";
import { getParkingJamGoalCellStyle } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/figure-size";
import { HowToPlayBoard } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/HowToPlayBoard";
import { prefersReducedMotion } from "@/lib/motion";

/** 始まりの盤面を見せておく間。どの車がどこを塞いでいるかを目で追える長さにする。 */
const GOAL_START_HOLD_MS = 1500;

/** `parking-jam-board.css` の出ていく動き（`pj-exit`）の長さ。 */
const EXIT_ANIMATION_MS = 520;

/**
 * 1台ずつ出し始める間。前の車が道路へ消えきってから次の車を出し、動く車を1台ずつにする。
 * 2台を続けて動かすと、どの車が出たから次の車の道が開いたのかを追えないため。
 */
const GOAL_EXIT_INTERVAL_MS = EXIT_ANIMATION_MS + 280;

const initialGoalState = createParkingJamInitialState(goalFigure.board);

/** 始まりの盤面から1台ずつ出した盤面。最後が空の駐車場。 */
const goalStates: readonly ParkingJamState[] = listGoalStates();

function listGoalStates(): ParkingJamState[] {
  let state = initialGoalState;
  return [
    state,
    ...goalFigure.moves.map((move) => {
      state = applyParkingJamMove(goalFigure.board, state, move) ?? state;
      return state;
    }),
  ];
}

const exitCount = goalFigure.moves.length;

/** 盤面を `step` 台出した姿にする、本番の盤面への手の知らせ。0台目は知らせない。 */
function getExitOperation(
  step: number,
  playCount: number,
): ParkingJamOperation | null {
  const move = goalFigure.moves[step - 1];
  if (!move) {
    return null;
  }
  return {
    // 見せ直しても本番の盤面が同じ知らせとみなさないよう、見せた回数ごとに番号を分ける。
    id: playCount * (exitCount + 1) + step,
    type: "exited",
    ...move,
  };
}

/**
 * 入口のゴールの盤面。開いたときに1回、始まりの盤面から本番と同じ走り去る動きで1台ずつ車を出し、
 * 最後の車で本番のクリアの動き（最後の車が道路へ走り去る）を返して、植え込みだけが残る空の駐車場で終える。音は鳴らさない。
 * 出している途中に盤面を押すと、残りを飛ばして空の駐車場をすぐ見せる。出し終えた後は見せ直すボタンを出し、見せ直すのはこのボタンだけにする。
 * 動きを減らす設定では、始まりの盤面を短く見せてから、空の駐車場を動かさずに見せる。
 */
export function GoalPlayback() {
  const [playCount, setPlayCount] = useState(0);
  const [step, setStep] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [settled, setSettled] = useState(false);

  const skipToGoal = useCallback(() => {
    setStep(exitCount);
    setSkipped(true);
    setSettled(true);
  }, []);

  // 出していく間合いはタイマーで刻む。見せ直すたびに刻み直すので、見せ直した回数で張り直す。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 見せ直した回数は、刻み直す合図としてだけ使う
  useEffect(() => {
    if (settled) {
      return;
    }
    const timers: number[] = [];
    if (prefersReducedMotion()) {
      timers.push(window.setTimeout(skipToGoal, GOAL_START_HOLD_MS));
    } else {
      for (let next = 1; next <= exitCount; next += 1) {
        timers.push(
          window.setTimeout(
            () => setStep(next),
            GOAL_START_HOLD_MS + (next - 1) * GOAL_EXIT_INTERVAL_MS,
          ),
        );
      }
    }
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [playCount, settled, skipToGoal]);

  const finishClearing = useCallback(() => setSettled(true), []);

  function replay() {
    setStep(0);
    setSkipped(false);
    setSettled(false);
    setPlayCount((count) => count + 1);
  }

  return (
    <div
      style={getParkingJamGoalCellStyle(HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX)}
    >
      <HowToPlayGoalFrame
        board={
          <div role="img" aria-label="ゴールの盤面">
            <HowToPlayBoard
              board={goalFigure.board}
              state={goalStates[step] ?? initialGoalState}
              selectedVehicleId={null}
              operation={skipped ? null : getExitOperation(step, playCount)}
              // 本番の盤面部品は、クリアの動きを止めるときに走り去る動きを取り消して車を元の場所へ戻すので、
              // 出し終えた後も止めずにおき、最後の車を道路の外に置いたままにする。
              clearing={!skipped && step === exitCount}
              onClearAnimationComplete={finishClearing}
            />
          </div>
        }
        skippable={!settled}
        skipLabel="空になった駐車場まで飛ばす"
        onSkip={skipToGoal}
        replayable={settled}
        onReplay={replay}
      />
    </div>
  );
}

export const _private = {
  GOAL_START_HOLD_MS,
  GOAL_EXIT_INTERVAL_MS,
  goalStates,
};
