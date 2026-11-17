import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX,
  HowToPlayGoalFrame,
} from "@/components/HowToPlayGoalFrame";
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import { applyWaterSortMove } from "@/games/water-sort/puzzle/rules";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import { POUR_ANIMATION_DURATION_MS } from "@/games/water-sort/ui/board/pour/pour-animation";
import { WATER_SORT_BOTTLE_ASPECT_RATIO } from "@/games/water-sort/ui/board/WaterSortBoard";
import { BottleSizeScope } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/BottleSizeScope";
import { getBottleRowWidthRatio } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/bottle-size";
import { goalFigure } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/figure-boards";
import { HowToPlayBoard } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/HowToPlayBoard";
import { onHowToPlayScroll } from "@/games/water-sort/ui/WaterSortHowToPlayDialog/how-to-play-scroll";
import { prefersReducedMotion } from "@/lib/motion";

/** 始まりの盤面を見せておく間。どの色がどこに混ざっているかを読み取れる長さにする。 */
const GOAL_START_HOLD_MS = 700;

/**
 * 1手ずつ注ぎ始める間。前の手のボトルが元の場所へ戻り切ってから次の手を始め、動くボトルを1本ずつにする。
 * 2本を同時に動かすと、傾いたボトルや戻るボトルが重なって、どこからどこへ注いだのか追えないため。
 */
const GOAL_POUR_INTERVAL_MS = POUR_ANIMATION_DURATION_MS + 100;

/** 始まりの盤面から1手ずつ注いだ盤面。最後がゴールの盤面。 */
const goalStates: readonly WaterSortState[] = listGoalStates();

function listGoalStates(): WaterSortState[] {
  const states: WaterSortState[] = [goalFigure.start];
  for (const move of goalFigure.moves) {
    const previous = states.at(-1) ?? goalFigure.start;
    states.push(applyWaterSortMove(previous, move) ?? previous);
  }
  return states;
}

const pourCount = goalFigure.moves.length;

/** 盤面を `step` 手目まで注いだ姿にする、本番の盤面への操作の知らせ。0手目は知らせない。 */
function getPourOperation(
  step: number,
  playCount: number,
): WaterSortOperation | null {
  const move = goalFigure.moves[step - 1];
  const stateBefore = goalStates[step - 1];
  const stateAfter = goalStates[step];
  if (!move || !stateBefore || !stateAfter) {
    return null;
  }
  return {
    // 見せ直しても本番の盤面が同じ知らせとみなさないよう、見せた回数ごとに番号を分ける。
    id: playCount * (pourCount + 1) + step,
    type: "poured",
    ...move,
    stateBefore,
    stateAfter,
    isClearingMove: step === pourCount,
  };
}

/**
 * ボトルの幅。置き場所の幅に5本と間が収まり、高さ（広い画面で渡される）に、注ぐ動きの余白・ボトル・見せ直すボタンの段と、
 * 遊び方の層が盤面の下に置くボタンの段が収まる大きさにし、例のボトルより大きくしない。
 */
const goalSizeStyle = {
  "--water-sort-figure-bottle": `min(calc(100cqw / ${getBottleRowWidthRatio(goalFigure.start.length)}), calc((100cqh - ${HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX}px - var(--how-to-play-goal-below, 0px)) / ${2 + 1 / WATER_SORT_BOTTLE_ASPECT_RATIO}), var(--water-sort-example-bottle))`,
} as CSSProperties;

/**
 * 入口のゴールの盤面。開いたときに1回、始まりの盤面から本番と同じ注ぐ動きで1手ずつ注いでそろえ、最後の手で本番の完成の動きを返す。音は鳴らさない。
 * 注いでいる途中に盤面を押すか、盤面を含む領域を送ると、残りを飛ばして、そろえ終えた最後の姿をすぐ見せる。
 * そろえ終えた後は、見せ直すボタンを出す。見せ直すのはこのボタンだけにする。
 * 盤面の外枠を置き場所に直接置き、遊び方の層が下に置くボタンを盤面と同じ幅にする。
 * 動きを減らす設定では、始まりの盤面を短く見せてから、ゴールの盤面を動かさずに見せる。
 */
export function GoalPlayback() {
  const [playCount, setPlayCount] = useState(0);
  const [step, setStep] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [settled, setSettled] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const skipToGoal = useCallback(() => {
    setStep(pourCount);
    setSkipped(true);
    setSettled(true);
  }, []);

  // 注いでいく間合いはタイマーで刻む。見せ直すたびに刻み直すので、見せ直した回数で張り直す。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 見せ直した回数は、刻み直す合図としてだけ使う
  useEffect(() => {
    if (settled || skipped) {
      return;
    }
    const timers: number[] = [];
    if (prefersReducedMotion()) {
      timers.push(
        window.setTimeout(() => {
          setStep(pourCount);
          setSkipped(true);
          setSettled(true);
        }, GOAL_START_HOLD_MS),
      );
    } else {
      for (let next = 1; next <= pourCount; next += 1) {
        timers.push(
          window.setTimeout(
            () => setStep(next),
            GOAL_START_HOLD_MS + (next - 1) * GOAL_POUR_INTERVAL_MS,
          ),
        );
      }
    }
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [playCount, settled, skipped]);

  // 注ぐ動きは画面の座標で描くので、盤面を送ると盤面から外れる。送ったら残りを飛ばし、そろえ終えた姿を見せる。
  useEffect(() => {
    const element = boardRef.current;
    if (settled || element === null) {
      return;
    }
    return onHowToPlayScroll(element, skipToGoal);
  }, [settled, skipToGoal]);

  const finishClearing = useCallback(() => setSettled(true), []);

  function replay() {
    setStep(0);
    setSkipped(false);
    setSettled(false);
    setPlayCount((count) => count + 1);
  }

  return (
    <BottleSizeScope size="goal">
      <div style={goalSizeStyle}>
        <HowToPlayGoalFrame
          board={
            <div role="img" aria-label="ゴールの盤面">
              <HowToPlayBoard
                ref={boardRef}
                size="goal"
                bottles={goalStates[step] ?? goalFigure.start}
                sourceBottleIndex={null}
                operation={skipped ? null : getPourOperation(step, playCount)}
                onClearAnimationComplete={finishClearing}
              />
            </div>
          }
          skippable={!settled}
          skipLabel="そろえ終えた姿まで飛ばす"
          onSkip={skipToGoal}
          replayable={settled}
          onReplay={replay}
        />
      </div>
    </BottleSizeScope>
  );
}

export const _private = {
  GOAL_START_HOLD_MS,
  GOAL_POUR_INTERVAL_MS,
  getPourOperation,
};
