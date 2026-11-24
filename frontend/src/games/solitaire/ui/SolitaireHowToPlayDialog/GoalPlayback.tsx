import { useCallback, useEffect, useState } from "react";

import { HowToPlayGoalFrame } from "@/components/HowToPlayGoalFrame";
import type { SolitaireOperation } from "@/games/solitaire/play/use-solitaire-play";
import { applySolitaireMove } from "@/games/solitaire/puzzle/rules";
import type { SolitaireState } from "@/games/solitaire/puzzle/state";
import {
  FigureCardSizeScope,
  FigureCardWidth,
} from "@/games/solitaire/ui/SolitaireHowToPlayDialog/FigureCardWidth";
import { goalFigure } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/figure-boards";
import { HowToPlayBoard } from "@/games/solitaire/ui/SolitaireHowToPlayDialog/HowToPlayBoard";
import { prefersReducedMotion } from "@/lib/motion";

/** 始まりの盤面を見せておく間。組札がどれも J まで積まれ、残りが列に並んでいることを読み取れる長さにする。 */
const GOAL_START_HOLD_MS = 900;

/**
 * 1手ずつ運び始める間。前の札が組札に着いてから次の札を動かし、動く札を1枚ずつにする。
 * 札が移る動き（200ms）に、どの列からどの組札へ運んだかを目で追える間を足す。
 */
const GOAL_MOVE_INTERVAL_MS = 360;

/** 始まりの盤面から1手ずつ運んだ盤面。最後がゴールの盤面。 */
const goalStates: readonly SolitaireState[] = listGoalStates();

function listGoalStates(): SolitaireState[] {
  const states: SolitaireState[] = [goalFigure.start];
  for (const move of goalFigure.moves) {
    const previous = states.at(-1) ?? goalFigure.start;
    states.push(applySolitaireMove(previous, move) ?? previous);
  }
  return states;
}

const moveCount = goalFigure.moves.length;

/** 盤面を `step` 手目まで運んだ姿にする、本番の盤面への操作の知らせ。0手目は知らせない。 */
function getMoveOperation(
  step: number,
  playCount: number,
): SolitaireOperation | null {
  const move = goalFigure.moves[step - 1];
  const stateBefore = goalStates[step - 1];
  if (!move || !stateBefore) {
    return null;
  }
  return {
    // 見せ直しても本番の盤面が同じ知らせとみなさないよう、見せた回数ごとに番号を分ける。
    id: playCount * (moveCount + 1) + step,
    type: "moved",
    move,
    stateBefore,
    isClearingMove: step === moveCount,
  };
}

/**
 * 入口のゴールの盤面。開いたときに1回、始まりの盤面から本番と同じ札が移る動きで1枚ずつ組札へ運び、最後の手で本番のクリアの動き
 * （組札を順に照らす）を返す。音は鳴らさない。
 * 運んでいる途中に盤面を押すと、残りを飛ばして、運び終えた最後の姿をすぐ見せる。運び終えた後は、見せ直すボタンを出す。
 * 動きを減らす設定では、始まりの盤面を短く見せてから、ゴールの盤面を動かさずに見せる。
 */
export function GoalPlayback() {
  const [playCount, setPlayCount] = useState(0);
  const [step, setStep] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [settled, setSettled] = useState(false);
  const skipToGoal = useCallback(() => {
    setStep(moveCount);
    setSkipped(true);
    setSettled(true);
  }, []);

  // 運んでいく間合いはタイマーで刻む。見せ直すたびに刻み直すので、見せ直した回数で張り直す。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 見せ直した回数は、刻み直す合図としてだけ使う
  useEffect(() => {
    if (settled || skipped) {
      return;
    }
    const timers: number[] = [];
    if (prefersReducedMotion()) {
      timers.push(window.setTimeout(skipToGoal, GOAL_START_HOLD_MS));
    } else {
      for (let next = 1; next <= moveCount; next += 1) {
        timers.push(
          window.setTimeout(
            () => setStep(next),
            GOAL_START_HOLD_MS + (next - 1) * GOAL_MOVE_INTERVAL_MS,
          ),
        );
      }
    }
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [playCount, settled, skipped, skipToGoal]);

  const finishClearing = useCallback(() => setSettled(true), []);

  function replay() {
    setStep(0);
    setSkipped(false);
    setSettled(false);
    setPlayCount((count) => count + 1);
  }

  return (
    <FigureCardSizeScope size="goal">
      <FigureCardWidth>
        {(cardWidth) => (
          <HowToPlayGoalFrame
            board={
              <div role="img" aria-label="ゴールの盤面">
                <HowToPlayBoard
                  state={goalStates[step] ?? goalFigure.start}
                  layout={goalFigure.layout}
                  cardWidth={cardWidth}
                  columnCardCapacity={goalFigure.columnCardCapacity}
                  selectedSource={null}
                  operation={skipped ? null : getMoveOperation(step, playCount)}
                  onClearAnimationComplete={finishClearing}
                />
              </div>
            }
            skippable={!settled}
            skipLabel="運び終えた姿まで飛ばす"
            onSkip={skipToGoal}
            replayable={settled}
            onReplay={replay}
          />
        )}
      </FigureCardWidth>
    </FigureCardSizeScope>
  );
}

export const _private = {
  GOAL_START_HOLD_MS,
  GOAL_MOVE_INTERVAL_MS,
  getMoveOperation,
  goalStates,
};
