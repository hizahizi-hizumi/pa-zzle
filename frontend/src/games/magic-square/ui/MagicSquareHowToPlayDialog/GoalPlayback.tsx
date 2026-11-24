import { useCallback, useEffect, useMemo, useState } from "react";

import {
  HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX,
  HowToPlayGoalFrame,
} from "@/components/HowToPlayGoalFrame";
import type { MagicSquareBoard as MagicSquareBoardCells } from "@/games/magic-square/puzzle/board";
import { listMagicSquareLineEvaluations } from "@/games/magic-square/puzzle/rules";
import { getMagicSquareFrameUnits } from "@/games/magic-square/ui/board/board-layout";
import { MagicSquareBoard } from "@/games/magic-square/ui/board/MagicSquareBoard";
import {
  goalBoard,
  listMagicSquareReadingOrder,
} from "@/games/magic-square/ui/MagicSquareHowToPlayDialog/figure-boards";
import { prefersReducedMotion } from "@/lib/motion";

/** 始まりの盤面を見せておく間。最初から置いてある数の並びを読み取れる長さにする。 */
const GOAL_START_HOLD_MS = 700;

/** 数を1つずつ置いていく間。置いた数と、列の端の合計が変わるのを目で追える長さにする。 */
const GOAL_PLACE_INTERVAL_MS = 260;

/** 埋まり切ってからクリア演出を始めるまでの間。最後に置いた数でそろった列を読み取れる長さにする。 */
const GOAL_CLEAR_DELAY_MS = 300;

function ignore(): void {}

/**
 * ゴールの盤面の大きさ。置き場所の幅・遊び方の層が渡す盤面の大きさの上限・置き場所の高さから盤面の下の段
 * （見せ直すボタンと遊び方の層が置くボタン）を除いた高さで決まる幅のうち、いちばん小さいものに合わせる。
 */
const units = getMagicSquareFrameUnits(goalBoard.answer.size);
const goalWidth = `min(100cqw, var(--how-to-play-goal-board-max, 100cqw), (100cqh - ${HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX}px - var(--how-to-play-goal-below, 0px)) * ${units.columns / units.rows})`;

/**
 * 入口のゴールの盤面。開いたときに1回、始まりの盤面から、1マスだけ空いた列の空きに答えの数を読む順に1つずつ置いていき、
 * 埋まり切ったら本番のクリア演出を1回だけ返す。盤面は本番の盤面の部品で描き、音は鳴らさない。
 * 置いている途中とクリア演出の途中に盤面を押すと、残りを飛ばして、埋め終えた最後の姿をすぐ見せる。クリア演出は返さない。
 * 埋まり切った後は、再生の形の小さな見せ直すボタンを盤面の右下の外に出す。見せ直すのはこのボタンだけにする。
 * 動きを減らす設定では、始まりの盤面を短く見せてから、ゴールの盤面を動かさずに見せる。
 */
export function GoalPlayback() {
  const order = useMemo(
    () => listMagicSquareReadingOrder(goalBoard.givens),
    [],
  );
  const [playCount, setPlayCount] = useState(0);
  const [placedCount, setPlacedCount] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [settled, setSettled] = useState(false);

  // 置いていく間合いはタイマーで刻む。見せ直すたびに刻み直すので、見せ直した回数で張り直す。
  // 最後の姿に落ち着いたら、残りのタイマーを止める。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 見せ直した回数は、刻み直す合図としてだけ使う
  useEffect(() => {
    if (settled) {
      return;
    }
    const total = order.length;
    const timers: number[] = [];
    if (prefersReducedMotion()) {
      timers.push(
        window.setTimeout(() => {
          setPlacedCount(total);
          setSettled(true);
        }, GOAL_START_HOLD_MS),
      );
    } else {
      for (let count = 1; count <= total; count += 1) {
        timers.push(
          window.setTimeout(
            () => setPlacedCount(count),
            GOAL_START_HOLD_MS + (count - 1) * GOAL_PLACE_INTERVAL_MS,
          ),
        );
      }
      timers.push(
        window.setTimeout(
          () => setCelebrating(true),
          GOAL_START_HOLD_MS +
            (total - 1) * GOAL_PLACE_INTERVAL_MS +
            GOAL_CLEAR_DELAY_MS,
        ),
      );
    }
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [playCount, order, settled]);

  const finishCelebration = useCallback(() => {
    setCelebrating(false);
    setSettled(true);
  }, []);

  const placed = new Set(order.slice(0, placedCount));
  const board: MagicSquareBoardCells = {
    size: goalBoard.answer.size,
    cells: goalBoard.answer.cells.map((cell, cellIndex) =>
      goalBoard.givens.cells[cellIndex] !== null || placed.has(cellIndex)
        ? cell
        : null,
    ),
  };

  function skipToGoal() {
    setPlacedCount(order.length);
    setCelebrating(false);
    setSettled(true);
  }

  function replay() {
    setPlacedCount(0);
    setCelebrating(false);
    setSettled(false);
    setPlayCount((count) => count + 1);
  }

  return (
    <HowToPlayGoalFrame
      board={
        <div role="img" aria-label="ゴールの盤面">
          {/* 盤面は本番の部品で描くが押せないので、マスのボタンを読み上げとフォーカスから外し、1枚の絵として名前で伝える。 */}
          <div
            aria-hidden="true"
            inert
            style={{
              width: goalWidth,
              aspectRatio: `${units.columns} / ${units.rows}`,
            }}
          >
            <MagicSquareBoard
              givens={goalBoard.givens}
              board={board}
              lineEvaluations={listMagicSquareLineEvaluations(board)}
              selectedCellIndex={null}
              interactionDisabled
              clearing={celebrating}
              onSelectCell={ignore}
              onClearAnimationComplete={finishCelebration}
            />
          </div>
        </div>
      }
      skippable={!settled}
      skipLabel="埋め終えた姿まで飛ばす"
      onSkip={skipToGoal}
      replayable={placedCount === order.length}
      onReplay={replay}
    />
  );
}

export const _private = {
  GOAL_START_HOLD_MS,
  GOAL_PLACE_INTERVAL_MS,
  GOAL_CLEAR_DELAY_MS,
};
