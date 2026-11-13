import { useCallback, useEffect, useMemo, useState } from "react";

import { HowToPlayExampleResetButton } from "@/components/HowToPlayExampleResetButton";
import { TakuzuClearAnimation } from "@/games/takuzu/ui/board/clear/TakuzuClearAnimation";
import {
  createTakuzuExampleBoard,
  type TakuzuExampleBoard,
} from "@/games/takuzu/ui/TakuzuHowToPlayDialog/example-board";
import type { TakuzuHowToPlayFigureBoard } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/figure-boards";
import { HowToPlayFigure } from "@/games/takuzu/ui/TakuzuHowToPlayDialog/HowToPlayFigure";
import { prefersReducedMotion } from "@/lib/motion";

type GoalPlaybackProps = {
  goal: TakuzuHowToPlayFigureBoard;
};

/** 始まりの盤面を見せておく間。何が最初からあるかを読み取れる長さにする。 */
const GOAL_START_HOLD_MS = 700;

/** タイルを1枚ずつ置いていく間。本番で置くときの出方が重なって見える短さにする。 */
const GOAL_PLACE_INTERVAL_MS = 45;

/** ゴールの盤面の、置くタイルのマスの番号を、盤面を読む順に並べる。 */
function listPlacedCellIndices(goal: TakuzuExampleBoard): number[] {
  return goal.board.cells.flatMap((cell, cellIndex) =>
    cell !== null && goal.givens.cells[cellIndex] === null ? [cellIndex] : [],
  );
}

/** 置いたタイルを先頭から `count` 枚だけ残した盤面。 */
function revealPlacedTiles(
  goal: TakuzuExampleBoard,
  placedCellIndices: readonly number[],
  count: number,
): TakuzuExampleBoard {
  const hidden = new Set(placedCellIndices.slice(count));
  return {
    ...goal,
    board: {
      ...goal.board,
      cells: goal.board.cells.map((cell, cellIndex) =>
        hidden.has(cellIndex) ? null : cell,
      ),
    },
  };
}

/**
 * 入口のゴールの盤面。開いたときに1回、始まりの盤面から、置いたタイルを本番で置くときと同じ出方で1枚ずつ置いていき、
 * 埋まり切ったら本番のクリア演出を1回だけ返す。音は鳴らさない。
 * 埋めている途中とクリア演出の途中に盤面を押すと、残りを飛ばして、埋め終えた最後の姿をすぐ見せる。クリア演出は返さない。
 * 埋まり切った後は、再生の形の小さな見せ直すボタンを盤面の右下の外に出す。見せ直すのはこのボタンだけにする。
 * 動きを減らす設定では、始まりの盤面を短く見せてから、ゴールの盤面を動かさずに見せる。
 */
export function GoalPlayback({ goal }: GoalPlaybackProps) {
  const goalExample = useMemo(() => createTakuzuExampleBoard(goal), [goal]);
  const placedCellIndices = useMemo(
    () => listPlacedCellIndices(goalExample),
    [goalExample],
  );
  const [playCount, setPlayCount] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [settled, setSettled] = useState(false);

  // 置いていく間合いはタイマーで刻む。見せ直すたびに刻み直すので、見せ直した回数で張り直す。
  // 最後の姿に落ち着いたら、残りのタイマーを止める。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 見せ直した回数は、刻み直す合図としてだけ使う
  useEffect(() => {
    if (settled) {
      return;
    }
    const total = placedCellIndices.length;
    const timers: number[] = [];
    if (prefersReducedMotion()) {
      timers.push(
        window.setTimeout(() => {
          setRevealedCount(total);
          setSettled(true);
        }, GOAL_START_HOLD_MS),
      );
    } else {
      for (let count = 1; count <= total; count += 1) {
        timers.push(
          window.setTimeout(
            () => setRevealedCount(count),
            GOAL_START_HOLD_MS + count * GOAL_PLACE_INTERVAL_MS,
          ),
        );
      }
      timers.push(
        window.setTimeout(
          () => setCelebrating(true),
          GOAL_START_HOLD_MS + (total + 4) * GOAL_PLACE_INTERVAL_MS,
        ),
      );
    }
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [playCount, placedCellIndices, settled]);

  const finishCelebration = useCallback(() => {
    setCelebrating(false);
    setSettled(true);
  }, []);
  const filled = revealedCount === placedCellIndices.length;

  function skipToGoal() {
    setRevealedCount(placedCellIndices.length);
    setCelebrating(false);
    setSettled(true);
  }

  function replay() {
    setRevealedCount(0);
    setCelebrating(false);
    setSettled(false);
    setPlayCount((count) => count + 1);
  }

  // 本番のクリア演出の包みは要素を1つ置くので、盤面を押して飛ばす所は、盤面に重ねた透明な面にする。
  // 飛ばすのは見ている途中の短い演出なので、指とマウスだけで受け、読み上げとキーボードには見せ直すボタンだけを出す。
  // 広い画面では、置き場所の幅と高さの小さい方に盤面を合わせるので、見せ直すボタンの段の高さを盤面の高さから除く。
  return (
    <div className="[--takuzu-goal-reserved-block:--spacing(11)]">
      <div className="flex w-fit flex-col items-end gap-2">
        <div className="relative">
          <TakuzuClearAnimation
            active={celebrating}
            onComplete={finishCelebration}
          >
            <HowToPlayFigure
              example={revealPlacedTiles(
                goalExample,
                placedCellIndices,
                revealedCount,
              )}
              size="goal"
              label="ゴールの盤面"
            />
          </TakuzuClearAnimation>
          {settled ? null : (
            <button
              type="button"
              aria-hidden="true"
              aria-label="埋め終えた姿まで飛ばす"
              tabIndex={-1}
              onClick={skipToGoal}
              className="absolute inset-0 cursor-pointer rounded-sm transition-colors duration-(--duration-fast) active:bg-foreground/5"
            />
          )}
        </div>
        {/* ボタンの右端を、盤面の右端にそろえる。 */}
        <span className="flex">
          <HowToPlayExampleResetButton
            action="replay"
            changed={filled}
            label="始まりの盤面から見せ直す"
            onPress={replay}
          />
        </span>
      </div>
    </div>
  );
}

export const _private = { GOAL_START_HOLD_MS, GOAL_PLACE_INTERVAL_MS };
