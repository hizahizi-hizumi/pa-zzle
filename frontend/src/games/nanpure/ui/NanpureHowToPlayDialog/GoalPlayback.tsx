import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX,
  HowToPlayGoalFrame,
} from "@/components/HowToPlayGoalFrame";
import type { NanpureBoard as NanpureBoardState } from "@/games/nanpure/puzzle/board";
import { NanpureClearAnimation } from "@/games/nanpure/ui/board/clear/NanpureClearAnimation";
import { NanpureBoard } from "@/games/nanpure/ui/board/NanpureBoard";
import { createNanpureExampleSession } from "@/games/nanpure/ui/NanpureHowToPlayDialog/example-board";
import { goalBoard } from "@/games/nanpure/ui/NanpureHowToPlayDialog/figure-boards";
import { prefersReducedMotion } from "@/lib/motion";

/** 始まりの盤面を見せておく間。最初からある数字の並びを読み取れる長さにする。 */
const GOAL_START_HOLD_MS = 700;

/** 数字を1つずつ入れていく間。本番で入れるときの出方が続いて見える短さにする。 */
const GOAL_ENTER_INTERVAL_MS = 45;

/** 埋まり切ってからクリア演出を始めるまでの間。最後に入れた数字を読み取れる長さにする。 */
const GOAL_CLEAR_DELAY_MS = 180;

const noIndices: readonly number[] = [];

/**
 * ゴールの盤面の大きさ。置き場所の幅と、置き場所の高さから盤面の下の段（見せ直すボタンと、遊び方の層が置くボタン）を除いた高さの、小さい方に合わせる。
 * 高さを渡さない置き場所では、高さは画面の高さになり、幅で決まる。
 */
const goalSizeClassName =
  "w-[min(100cqw,var(--how-to-play-goal-board-max,100cqw),calc(100cqh-var(--nanpure-goal-reserved-block)-var(--how-to-play-goal-below,0px)))]";

/**
 * 入口のゴールの盤面。開いたときに1回、始まりの盤面から、空いたマスに答えの数字を読む順に1つずつ入れていき、
 * 埋まり切ったら本番のクリア演出を1回だけ返す。盤面は本番の盤面の部品で描き、音は鳴らさない。
 * 埋めている途中とクリア演出の途中に盤面を押すと、残りを飛ばして、埋め終えた最後の姿をすぐ見せる。クリア演出は返さない。
 * 埋まり切った後は、再生の形の小さな見せ直すボタンを盤面の右下の外に出す。見せ直すのはこのボタンだけにする。
 * 動きを減らす設定では、始まりの盤面を短く見せてから、ゴールの盤面を動かさずに見せる。
 */
export function GoalPlayback() {
  const { clues, solution } = useMemo(
    () => createNanpureExampleSession(goalBoard).problem,
    [],
  );
  const enteredCellIndices = useMemo(
    () =>
      clues.flatMap((cell, cellIndex) => (cell === null ? [cellIndex] : [])),
    [clues],
  );
  const emptyNotes = useMemo(() => clues.map(() => []), [clues]);
  const [playCount, setPlayCount] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [settled, setSettled] = useState(false);

  // 入れていく間合いはタイマーで刻む。見せ直すたびに刻み直すので、見せ直した回数で張り直す。
  // 最後の姿に落ち着いたら、残りのタイマーを止める。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 見せ直した回数は、刻み直す合図としてだけ使う
  useEffect(() => {
    if (settled) {
      return;
    }
    const total = enteredCellIndices.length;
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
            GOAL_START_HOLD_MS + count * GOAL_ENTER_INTERVAL_MS,
          ),
        );
      }
      timers.push(
        window.setTimeout(
          () => setCelebrating(true),
          GOAL_START_HOLD_MS +
            total * GOAL_ENTER_INTERVAL_MS +
            GOAL_CLEAR_DELAY_MS,
        ),
      );
    }
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [playCount, enteredCellIndices, settled]);

  const finishCelebration = useCallback(() => {
    setCelebrating(false);
    setSettled(true);
  }, []);
  const filled = revealedCount === enteredCellIndices.length;
  const revealed = new Set(enteredCellIndices.slice(0, revealedCount));
  const board: NanpureBoardState = clues.map((cell, cellIndex) =>
    cell !== null || revealed.has(cellIndex)
      ? (solution[cellIndex] ?? null)
      : null,
  );

  function skipToGoal() {
    setRevealedCount(enteredCellIndices.length);
    setCelebrating(false);
    setSettled(true);
  }

  function replay() {
    setRevealedCount(0);
    setCelebrating(false);
    setSettled(false);
    setPlayCount((count) => count + 1);
  }

  return (
    <div
      style={
        {
          // 広い画面では、置き場所の幅と高さの小さい方に盤面を合わせるので、見せ直すボタンの段の高さを盤面の高さから除く。
          "--nanpure-goal-reserved-block": `${HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX}px`,
        } as CSSProperties
      }
    >
      <HowToPlayGoalFrame
        board={
          <div role="img" aria-label="ゴールの盤面">
            {/* 盤面は本番の部品で描くが押せないので、マスのボタンを読み上げとフォーカスから外し、1枚の絵として名前で伝える。 */}
            <div aria-hidden="true" inert>
              <NanpureClearAnimation
                active={celebrating}
                onComplete={finishCelebration}
              >
                <NanpureBoard
                  board={board}
                  clues={clues}
                  notes={emptyNotes}
                  selectedCellIndex={null}
                  conflictCellIndices={noIndices}
                  mistakeCellIndices={noIndices}
                  sizeClassName={goalSizeClassName}
                  onSelectCell={ignoreSelection}
                />
              </NanpureClearAnimation>
            </div>
          </div>
        }
        skippable={!settled}
        skipLabel="埋め終えた姿まで飛ばす"
        onSkip={skipToGoal}
        replayable={filled}
        onReplay={replay}
      />
    </div>
  );
}

function ignoreSelection() {}

export const _private = {
  GOAL_START_HOLD_MS,
  GOAL_ENTER_INTERVAL_MS,
  GOAL_CLEAR_DELAY_MS,
};
