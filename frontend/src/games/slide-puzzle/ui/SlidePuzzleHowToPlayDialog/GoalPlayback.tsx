import { useCallback, useEffect, useState } from "react";

import { HowToPlayGoalFrame } from "@/components/HowToPlayGoalFrame";
import type { SlidePuzzleOperation } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import {
  applySlidePuzzleSlide,
  getSlidePuzzleSlide,
} from "@/games/slide-puzzle/puzzle/rules";
import type { SlidePuzzleBoard } from "@/games/slide-puzzle/puzzle/state";
import { goalFigure } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/figure-boards";
import { HowToPlayBoard } from "@/games/slide-puzzle/ui/SlidePuzzleHowToPlayDialog/HowToPlayBoard";
import { prefersReducedMotion } from "@/lib/motion";

/** 始まりの盤面を見せておく間。どのタイルがどこにあるかを読み取れる長さにする。 */
const GOAL_START_HOLD_MS = 900;

/** 1手ずつスライドさせる間。前の手のタイルが収まってから、どのタイルを押したかを目で追える長さにする。 */
const GOAL_SLIDE_INTERVAL_MS = 550;

type SlidOperation = Extract<SlidePuzzleOperation, { type: "slid" }>;

/** 始まりの盤面から、本番のスライドで1手ずつ並べていく知らせ。最後の手で完成する。 */
const goalOperations: readonly SlidOperation[] = listGoalOperations();

function listGoalOperations(): SlidOperation[] {
  const operations: SlidOperation[] = [];
  let board: SlidePuzzleBoard = goalFigure.start;
  for (const [index, tile] of goalFigure.tappedTiles.entries()) {
    const slide = getSlidePuzzleSlide(board, board.indexOf(tile));
    if (slide === null) {
      break;
    }
    const boardAfter = applySlidePuzzleSlide(board, slide);
    operations.push({
      id: index + 1,
      type: "slid",
      slide,
      boardBefore: board,
      boardAfter,
      isClearingMove: index === goalFigure.tappedTiles.length - 1,
    });
    board = boardAfter;
  }
  return operations;
}

const goalBoard = goalOperations.at(-1)?.boardAfter ?? goalFigure.start;

/** `step` 手目までスライドさせた盤面。 */
function getBoardAt(step: number): SlidePuzzleBoard {
  return goalOperations[step - 1]?.boardAfter ?? goalFigure.start;
}

/**
 * 入口のゴールの盤面。開いたときに1回、始まりの盤面から本番と同じスライドで1手ずつ並べ、完成したら本番のクリアの波を返す。音は鳴らさない。
 * 並べている途中とクリアの波の途中に盤面を押すと、残りを飛ばして、完成した最後の姿をすぐ見せる。
 * 完成した後は、見せ直すボタンを出す。見せ直すのはこのボタンだけにする。
 * 動きを減らす設定では、始まりの盤面を短く見せてから、完成した盤面を動かさずに見せる。
 */
export function GoalPlayback() {
  const [playCount, setPlayCount] = useState(0);
  const [step, setStep] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [settled, setSettled] = useState(false);
  const stepCount = goalOperations.length;

  // スライドさせる間合いはタイマーで刻む。見せ直すたびに刻み直すので、見せ直した回数で張り直す。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 見せ直した回数は、刻み直す合図としてだけ使う
  useEffect(() => {
    if (settled || skipped) {
      return;
    }
    const timers: number[] = [];
    if (prefersReducedMotion()) {
      timers.push(
        window.setTimeout(() => {
          setStep(stepCount);
          setSkipped(true);
          setSettled(true);
        }, GOAL_START_HOLD_MS),
      );
    } else {
      for (let next = 1; next <= stepCount; next += 1) {
        timers.push(
          window.setTimeout(
            () => setStep(next),
            GOAL_START_HOLD_MS + (next - 1) * GOAL_SLIDE_INTERVAL_MS,
          ),
        );
      }
    }
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [playCount, settled, skipped, stepCount]);

  const finishClearing = useCallback(() => setSettled(true), []);

  function skipToGoal() {
    setStep(stepCount);
    setSkipped(true);
    setSettled(true);
  }

  function replay() {
    setStep(0);
    setSkipped(false);
    setSettled(false);
    setPlayCount((count) => count + 1);
  }

  const operation = skipped ? null : (goalOperations[step - 1] ?? null);
  return (
    <HowToPlayGoalFrame
      board={
        <div role="img" aria-label="ゴールの盤面">
          <HowToPlayBoard
            board={skipped ? goalBoard : getBoardAt(step)}
            size="goal"
            // 見せ直しても本番の盤面が同じ知らせとみなさないよう、見せた回数ごとに番号を分ける。
            operation={
              operation === null
                ? null
                : { ...operation, id: playCount * stepCount + operation.id }
            }
            clearing={!skipped && !settled && step === stepCount}
            onClearAnimationComplete={finishClearing}
          />
        </div>
      }
      skippable={!settled}
      skipLabel="完成した姿まで飛ばす"
      onSkip={skipToGoal}
      replayable={settled}
      onReplay={replay}
    />
  );
}

export const _private = {
  GOAL_START_HOLD_MS,
  GOAL_SLIDE_INTERVAL_MS,
  goalOperations,
};
