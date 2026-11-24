import { type CSSProperties, useCallback, useEffect, useState } from "react";

import {
  HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX,
  HowToPlayGoalFrame,
} from "@/components/HowToPlayGoalFrame";
import { listFukumenzanLetters } from "@/games/fukumenzan/puzzle/equation";
import {
  listFukumenzanLeadingZeroLetters,
  listFukumenzanMiscalculatedColumns,
} from "@/games/fukumenzan/puzzle/rules";
import type { FukumenzanPuzzleState } from "@/games/fukumenzan/puzzle/state";
import { placeFukumenzanDigit } from "@/games/fukumenzan/puzzle/transitions";
import { FukumenzanEquationBoard } from "@/games/fukumenzan/ui/board/FukumenzanEquationBoard";
import { createExamplePuzzleState } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-board";
import {
  goalSteps,
  howToPlayProblem,
} from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/example-definitions";
import { GoalGround } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/GoalGround";
import { getStaticLetterHandlers } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/static-input";
import { exampleEquationAttributes } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/use-equation-grid";
import { prefersReducedMotion } from "@/lib/motion";

/** 始まりの式を見せておく間。式の文字と並びを読み取れる長さにする。 */
const GOAL_START_HOLD_MS = 800;

/** 札を1文字ずつ入れる間。入った札の数字を読んでから次の文字へ移る長さにする。 */
const GOAL_STEP_INTERVAL_MS = 450;

/** 盤面の下に敷く紙（`GoalGround`）の、内側の余白の両側の合計（px）。 */
const GOAL_GROUND_PADDING_PX = 16;

const letters = listFukumenzanLetters(howToPlayProblem);
const columnCount = howToPlayProblem.result.length + 1;
const rowCount = howToPlayProblem.addends.length + 1;

function getStateAfter(stepCount: number): FukumenzanPuzzleState {
  return goalSteps
    .slice(0, stepCount)
    .reduce(
      (state, { letter, digit }) =>
        placeFukumenzanDigit(state, letters.indexOf(letter), digit),
      createExamplePuzzleState({ placed: {} }),
    );
}

/**
 * 式のマスの一辺。置き場所の幅と、高さ（広い画面で渡される）から見せ直すボタンの段と遊び方の層が盤面の下に置くボタンの段を除いた高さの、
 * 小さい方に合わせる。マスはスマホの幅では 4rem まで、広い画面では例のマス（3.375rem）の約1.1倍の 3.75rem までにし、例と同じ物に見せる。
 */
const goalTileStyle = {
  "--fukumenzan-goal-tile": `min((min(100cqw, var(--how-to-play-goal-board-max, 100cqw)) - ${GOAL_GROUND_PADDING_PX}px) / ${columnCount}, (100cqh - ${HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX + GOAL_GROUND_PADDING_PX}px - var(--how-to-play-goal-below, 0px) - 1rem) / ${rowCount}, var(--fukumenzan-goal-tile-max))`,
} as CSSProperties;

const equationStyle = {
  width: `calc(var(--fukumenzan-goal-tile) * ${columnCount})`,
  height: `calc(var(--fukumenzan-goal-tile) * ${rowCount} + 1rem)`,
} satisfies CSSProperties;

/**
 * 入口のゴールの盤面。開いたときに1回、空の式に一の位の文字から札を1つずつ入れていき、
 * 入れ終えたら本番のクリア演出（答えの桁を一の位から跳ねさせる）を1回だけ返す。音は鳴らさない。
 * 入れていく途中とクリア演出の途中に盤面を押すと、残りを飛ばして、入れ終えた最後の姿をすぐ見せる。
 * 入れ終えた後は、見せ直すボタンを出す。見せ直すのはこのボタンだけにする。
 * 動きを減らす設定では、始まりの式を短く見せてから、入れ終えた式を動かさずに見せる。
 */
export function GoalPlayback() {
  const [stepCount, setStepCount] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [settled, setSettled] = useState(false);
  const puzzleState = getStateAfter(stepCount);

  // 入れていく間合いはタイマーで刻む。見せ直すボタンは見せ終えた後にだけ押せ、見せ終えたことを下げるので、そこで刻み直す。
  useEffect(() => {
    if (settled) {
      return;
    }
    const timers: number[] = [];
    if (prefersReducedMotion()) {
      timers.push(
        window.setTimeout(() => {
          setStepCount(goalSteps.length);
          setSettled(true);
        }, GOAL_START_HOLD_MS),
      );
    } else {
      for (let next = 1; next <= goalSteps.length; next += 1) {
        timers.push(
          window.setTimeout(
            () => setStepCount(next),
            GOAL_START_HOLD_MS + (next - 1) * GOAL_STEP_INTERVAL_MS,
          ),
        );
      }
      timers.push(
        window.setTimeout(
          () => setCelebrating(true),
          GOAL_START_HOLD_MS + goalSteps.length * GOAL_STEP_INTERVAL_MS,
        ),
      );
    }
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [settled]);

  const finishCelebration = useCallback(() => {
    setCelebrating(false);
    setSettled(true);
  }, []);

  function skipToGoal() {
    setStepCount(goalSteps.length);
    setCelebrating(false);
    setSettled(true);
  }

  function replay() {
    setStepCount(0);
    setCelebrating(false);
    setSettled(false);
  }

  return (
    <div
      className="flex justify-center [--fukumenzan-goal-tile-max:4rem] lg:[--fukumenzan-goal-tile-max:3.75rem]"
      style={goalTileStyle}
    >
      <HowToPlayGoalFrame
        board={
          <GoalGround>
            <div
              {...exampleEquationAttributes}
              role="img"
              aria-label="ゴールの式"
              inert
              className="[container-type:size]"
              style={equationStyle}
            >
              <FukumenzanEquationBoard
                problem={howToPlayProblem}
                letters={letters}
                puzzleState={puzzleState}
                leadingZeroLetters={listFukumenzanLeadingZeroLetters(
                  howToPlayProblem,
                  puzzleState,
                )}
                miscalculatedColumns={listFukumenzanMiscalculatedColumns(
                  howToPlayProblem,
                  puzzleState,
                )}
                selection={null}
                drag={null}
                clearing={celebrating}
                interactionDisabled
                getLetterHandlers={getStaticLetterHandlers}
                onClearAnimationComplete={finishCelebration}
              />
            </div>
          </GoalGround>
        }
        skippable={!settled}
        skipLabel="札を入れ終えた姿まで飛ばす"
        onSkip={skipToGoal}
        replayable={settled}
        onReplay={replay}
      />
    </div>
  );
}

export const _private = {
  GOAL_START_HOLD_MS,
  GOAL_STEP_INTERVAL_MS,
};
