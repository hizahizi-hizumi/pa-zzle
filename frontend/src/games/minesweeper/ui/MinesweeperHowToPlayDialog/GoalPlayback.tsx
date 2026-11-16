import { useCallback, useEffect, useMemo, useState } from "react";

import { HowToPlayGoalFrame } from "@/components/HowToPlayGoalFrame";
import { MinesweeperClearAnimation } from "@/games/minesweeper/ui/board/clear/MinesweeperClearAnimation";
import {
  createMinesweeperExampleBoard,
  listMinesweeperExampleSolveSteps,
} from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/example-board";
import { goalFigure } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/figure-boards";
import { HowToPlayBoard } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog/HowToPlayBoard";
import { prefersReducedMotion } from "@/lib/motion";

/** 始まりの盤面を見せておく間。最初から開いているマスを読み取れる長さにする。 */
const GOAL_START_HOLD_MS = 1200;

/** マスを1つずつ開いていく間。本番で次々に開いていくように見える短さにする。 */
const GOAL_OPEN_INTERVAL_MS = 110;

/**
 * 入口のゴールの盤面。開いたときに1回、右下だけが開いた始まりの盤面から、開いたマスに続く地雷ではないマスを本番の関数で1つずつ開いていき
 * （周りに地雷の無いマスは周りも続けて開く）、すべて開くと本番と同じく閉じたままの地雷を見せて、本番のクリア演出を1回だけ返す。音は鳴らさない。
 * 開いている途中とクリア演出の途中に盤面を押すと、残りを飛ばして、開き終えた最後の姿をすぐ見せる。クリア演出は返さない。
 * 開き終えた後は、再生の形の小さな見せ直すボタンを盤面の右下の外に出す。見せ直すのはこのボタンだけにする。
 * 動きを減らす設定では、始まりの盤面を短く見せてから、ゴールの盤面を動かさずに見せる。
 */
export function GoalPlayback() {
  const start = useMemo(() => createMinesweeperExampleBoard(goalFigure), []);
  const steps = useMemo(() => listMinesweeperExampleSolveSteps(start), [start]);
  const [playCount, setPlayCount] = useState(0);
  const [openedCount, setOpenedCount] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [settled, setSettled] = useState(false);

  // 開いていく間合いはタイマーで刻む。見せ直すたびに刻み直すので、見せ直した回数で張り直す。
  // 最後の姿に落ち着いたら、残りのタイマーを止める。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 見せ直した回数は、刻み直す合図としてだけ使う
  useEffect(() => {
    if (settled) {
      return;
    }
    const total = steps.length;
    const timers: number[] = [];
    if (prefersReducedMotion()) {
      timers.push(
        window.setTimeout(() => {
          setOpenedCount(total);
          setSettled(true);
        }, GOAL_START_HOLD_MS),
      );
    } else {
      for (let count = 1; count <= total; count += 1) {
        timers.push(
          window.setTimeout(
            () => setOpenedCount(count),
            GOAL_START_HOLD_MS + count * GOAL_OPEN_INTERVAL_MS,
          ),
        );
      }
      timers.push(
        window.setTimeout(
          () => setCelebrating(true),
          GOAL_START_HOLD_MS + (total + 2) * GOAL_OPEN_INTERVAL_MS,
        ),
      );
    }
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [playCount, steps, settled]);

  const finishCelebration = useCallback(() => {
    setCelebrating(false);
    setSettled(true);
  }, []);

  function skipToGoal() {
    setOpenedCount(steps.length);
    setCelebrating(false);
    setSettled(true);
  }

  function replay() {
    setOpenedCount(0);
    setCelebrating(false);
    setSettled(false);
    setPlayCount((count) => count + 1);
  }

  const shown = openedCount === 0 ? start : (steps[openedCount - 1] ?? start);

  return (
    <HowToPlayGoalFrame
      board={
        <MinesweeperClearAnimation
          active={celebrating}
          onComplete={finishCelebration}
        >
          <HowToPlayBoard example={shown} size="goal" label="ゴールの盤面" />
        </MinesweeperClearAnimation>
      }
      skippable={!settled}
      skipLabel="開き終えた姿まで飛ばす"
      onSkip={skipToGoal}
      replayable={openedCount === steps.length}
      onReplay={replay}
    />
  );
}

export const _private = { GOAL_START_HOLD_MS, GOAL_OPEN_INTERVAL_MS };
