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
import { HitofudePuzzleFigure } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleFigure";
import { playClearTrace } from "@/games/hitofude-puzzle/ui/board/play-clear-trace";
import { hitofudePuzzleGroundClassName } from "@/games/hitofude-puzzle/ui/HitofudePuzzleGround";
import { goalFigure } from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/figure-boards";
import {
  getHitofudePuzzleFigureSide,
  hitofudePuzzleGoalCellMaxClassName,
} from "@/games/hitofude-puzzle/ui/HitofudePuzzleHowToPlayDialog/figure-size";
import { prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** 始まりの盤面を見せておく間。始点と穴の形を読み取れる長さにする。 */
const GOAL_START_HOLD_MS = 700;

/** 道を1マスずつ延ばす間。指でなぞって引いていく速さに見える短さにする。 */
const GOAL_EXTEND_INTERVAL_MS = 45;

const { board, solution } = goalFigure;

/** 盤面のマスの大きさ。置き場所の幅と、高さ（広い画面で渡される）から見せ直すボタンの段と、遊び方の層が盤面の下に置くボタンの段を除いた高さの、小さい方に盤面を合わせる。 */
const goalSizeStyle = {
  "--hitofude-figure-cell": `min(calc(min(100cqw, var(--how-to-play-goal-board-max, 100cqw), 100cqh - ${HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX}px - var(--how-to-play-goal-below, 0px)) / ${board.size}), var(--hitofude-goal-cell-max, 100cqw))`,
} as CSSProperties;

/**
 * 入口のゴールの盤面。開いたときに1回、始点だけの盤面から、道を1マスずつ延ばしてすべてのマスを通し、
 * 通し終えたら本番のクリア演出（光でなぞり、終点に印を置く）を1回だけ返す。音は鳴らさない。
 * 延ばしている途中とクリア演出の途中に盤面を押すと、残りを飛ばして、通し終えた最後の姿をすぐ見せる。
 * 通し終えた後は、見せ直すボタンを出す。見せ直すのはこのボタンだけにする。
 * 動きを減らす設定では、始まりの盤面を短く見せてから、通し終えた盤面を動かさずに見せる。
 */
export function GoalPlayback() {
  const [playCount, setPlayCount] = useState(0);
  const [length, setLength] = useState(1);
  const [celebrating, setCelebrating] = useState(false);
  const [settled, setSettled] = useState(false);
  const figureRef = useRef<SVGSVGElement>(null);
  const filled = length === solution.length;

  // 延ばしていく間合いはタイマーで刻む。見せ直すたびに刻み直すので、見せ直した回数で張り直す。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 見せ直した回数は、刻み直す合図としてだけ使う
  useEffect(() => {
    if (settled) {
      return;
    }
    const timers: number[] = [];
    if (prefersReducedMotion()) {
      timers.push(
        window.setTimeout(() => {
          setLength(solution.length);
          setSettled(true);
        }, GOAL_START_HOLD_MS),
      );
    } else {
      for (let next = 2; next <= solution.length; next += 1) {
        timers.push(
          window.setTimeout(
            () => setLength(next),
            GOAL_START_HOLD_MS + (next - 1) * GOAL_EXTEND_INTERVAL_MS,
          ),
        );
      }
      timers.push(
        window.setTimeout(
          () => setCelebrating(true),
          GOAL_START_HOLD_MS + solution.length * GOAL_EXTEND_INTERVAL_MS,
        ),
      );
    }
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [playCount, settled]);

  const finishCelebration = useCallback(() => {
    setCelebrating(false);
    setSettled(true);
  }, []);

  useEffect(() => {
    if (!celebrating) {
      return;
    }
    return playClearTrace(
      figureRef.current,
      solution.length,
      finishCelebration,
    );
  }, [celebrating, finishCelebration]);

  function skipToGoal() {
    setLength(solution.length);
    setCelebrating(false);
    setSettled(true);
  }

  function replay() {
    setLength(1);
    setCelebrating(false);
    setSettled(false);
    setPlayCount((count) => count + 1);
  }

  const side = getHitofudePuzzleFigureSide(board.size);
  return (
    <div className={hitofudePuzzleGoalCellMaxClassName} style={goalSizeStyle}>
      <HowToPlayGoalFrame
        board={
          <div
            role="img"
            aria-label="ゴールの盤面"
            // 穴と縁の欠けを本番と同じ色で見せるよう、盤面の下にプレイ画面と同じ地を敷く。
            className={cn("relative", hitofudePuzzleGroundClassName)}
            style={{ width: side, height: side }}
          >
            <HitofudePuzzleFigure
              ref={figureRef}
              board={board}
              path={solution.slice(0, length)}
              isDeadEnd={false}
              solved={filled && (celebrating || settled)}
            />
          </div>
        }
        skippable={!settled}
        skipLabel="通し終えた姿まで飛ばす"
        onSkip={skipToGoal}
        replayable={settled}
        onReplay={replay}
      />
    </div>
  );
}

export const _private = { GOAL_START_HOLD_MS, GOAL_EXTEND_INTERVAL_MS };
