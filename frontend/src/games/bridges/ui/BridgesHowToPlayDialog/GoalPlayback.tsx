import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX,
  HowToPlayGoalFrame,
} from "@/components/HowToPlayGoalFrame";
import { getBridgesNetwork } from "@/games/bridges/puzzle/board";
import { listBridgesIslandStatuses } from "@/games/bridges/puzzle/rules";
import type { BridgeCount } from "@/games/bridges/puzzle/state";
import { goalFigure } from "@/games/bridges/ui/BridgesHowToPlayDialog/figure-boards";
import {
  BRIDGES_GOAL_CELL_MAX_PX,
  BRIDGES_GOAL_VIEW_WIDTH,
} from "@/games/bridges/ui/BridgesHowToPlayDialog/figure-size";
import { COMPACT_CELL_PX } from "@/games/bridges/ui/board/BridgesBoard";
import { BridgesFigure } from "@/games/bridges/ui/board/BridgesFigure";
import {
  createBoardView,
  getIslandCenter,
  toViewPoint,
} from "@/games/bridges/ui/board/board-geometry";
import { getBridgeExtendMs } from "@/games/bridges/ui/board/bridge-extend";
import { playBridgeMotion } from "@/games/bridges/ui/board/play-bridge-motion";
import { playClearWave } from "@/games/bridges/ui/board/play-clear-wave";
import { prefersReducedMotion } from "@/lib/motion";

/** 始まりの盤面を見せておく間。島の数字と並びを読み取れる長さにする。 */
const GOAL_START_HOLD_MS = 800;

/** 板を1枚ずつ架ける間。板が渡り切ってから次の板を架ける長さにし、架けていく速さに見せる。 */
const GOAL_PLANK_INTERVAL_MS = 230;

const { board, steps } = goalFigure;
const view = createBoardView(board);
const { edges } = getBridgesNetwork(board);

/** 板を1枚ずつ架ける順。2本の辺は、続けて2枚を架ける。 */
const planks = steps.flatMap(({ edge, count }) =>
  Array.from({ length: count }, (_, index) => ({
    edge,
    count: (index + 1) as BridgeCount,
  })),
);

const lastEdge = planks.at(-1)!.edge;

function getBridgesAfter(plankCount: number): BridgeCount[] {
  const bridges = edges.map((): BridgeCount => 0);
  for (const { edge, count } of planks.slice(0, plankCount)) {
    bridges[edge] = count;
  }
  return bridges;
}

/**
 * 盤面の一辺。置き場所の幅と、高さ（広い画面で渡される）から見せ直すボタンの段と、遊び方の層が盤面の下に置くボタンの段を除いた高さの、
 * 小さい方に合わせ、広い画面ではマスを 60px までにする。
 */
const goalSideStyle = {
  "--bridges-goal-side": `min(100cqw, var(--how-to-play-goal-board-max, 100cqw), 100cqh - ${HOW_TO_PLAY_GOAL_REPLAY_ROW_HEIGHT_PX}px - var(--how-to-play-goal-below, 0px), ${BRIDGES_GOAL_CELL_MAX_PX * BRIDGES_GOAL_VIEW_WIDTH}px)`,
} as CSSProperties;

/**
 * 入口のゴールの盤面。開いたときに1回、橋の無い盤面から、本番と同じ板の動きで橋を1枚ずつ架けていき、
 * 架け終えたら本番のクリア演出（最後の橋から光を島から島へ渡す）を1回だけ返す。音は鳴らさない。
 * 架けていく途中とクリア演出の途中に盤面を押すと、残りを飛ばして、架け終えた最後の姿をすぐ見せる。
 * 架け終えた後は、見せ直すボタンを出す。見せ直すのはこのボタンだけにする。
 * 動きを減らす設定では、始まりの盤面を短く見せてから、架け終えた盤面を動かさずに見せる。
 * 島の数字の色は本番と同じく、架けた本数で、足りない・ちょうどへ変わっていく。
 */
export function GoalPlayback() {
  const [plankCount, setPlankCount] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [settled, setSettled] = useState(false);
  const [side, setSide] = useState<number | null>(null);
  const figureRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const bridges = getBridgesAfter(plankCount);
  const filled = plankCount === planks.length;

  useLayoutEffect(() => {
    const element = boxRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setSide(entry.contentRect.width);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // 架けていく間合いはタイマーで刻む。見せ直すボタンは見せ終えた後にだけ押せ、見せ終えたことを下げるので、そこで刻み直す。
  useEffect(() => {
    if (settled) {
      return;
    }
    const timers: number[] = [];
    if (prefersReducedMotion()) {
      timers.push(
        window.setTimeout(() => {
          setPlankCount(planks.length);
          setSettled(true);
        }, GOAL_START_HOLD_MS),
      );
    } else {
      for (let next = 1; next <= planks.length; next += 1) {
        timers.push(
          window.setTimeout(
            () => setPlankCount(next),
            GOAL_START_HOLD_MS + (next - 1) * GOAL_PLANK_INTERVAL_MS,
          ),
        );
      }
      timers.push(
        window.setTimeout(
          () => setCelebrating(true),
          GOAL_START_HOLD_MS + planks.length * GOAL_PLANK_INTERVAL_MS,
        ),
      );
    }
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [settled]);

  // 架けた板を、本番と同じく、辺の上か左の島から相手の島へ伸ばす。
  useLayoutEffect(() => {
    if (plankCount === 0 || settled) {
      return;
    }
    const { edge, count } = planks[plankCount - 1]!;
    const { from, orientation } = edges[edge]!;
    playBridgeMotion(
      figureRef.current,
      edge,
      count,
      toViewPoint(view, getIslandCenter(board.islands[from]!)),
      orientation === "horizontal",
      getBridgeExtendMs(board, edge),
    );
  }, [plankCount, settled]);

  const finishCelebration = useCallback(() => {
    setCelebrating(false);
    setSettled(true);
  }, []);

  useLayoutEffect(() => {
    if (!celebrating) {
      return;
    }
    return playClearWave(
      figureRef.current,
      board,
      getBridgesAfter(planks.length),
      lastEdge,
      finishCelebration,
    );
  }, [celebrating, finishCelebration]);

  function skipToGoal() {
    setPlankCount(planks.length);
    setCelebrating(false);
    setSettled(true);
  }

  function replay() {
    setPlankCount(0);
    setCelebrating(false);
    setSettled(false);
  }

  return (
    <div style={goalSideStyle}>
      <HowToPlayGoalFrame
        board={
          <div
            ref={boxRef}
            role="img"
            aria-label="ゴールの盤面"
            className="relative overflow-hidden rounded-md"
            style={{
              width: "var(--bridges-goal-side)",
              height: "var(--bridges-goal-side)",
            }}
          >
            <BridgesFigure
              ref={figureRef}
              board={board}
              view={view}
              bridges={bridges}
              islandStatuses={listBridgesIslandStatuses(board, { bridges })}
              showsSea
              lit={filled && (celebrating || settled)}
              clearOriginEdge={lastEdge}
              compact={side !== null && side / view.width < COMPACT_CELL_PX}
            />
          </div>
        }
        skippable={!settled}
        skipLabel="架け終えた姿まで飛ばす"
        onSkip={skipToGoal}
        replayable={settled}
        onReplay={replay}
      />
    </div>
  );
}

export const _private = {
  GOAL_START_HOLD_MS,
  GOAL_PLANK_INTERVAL_MS,
  planks,
};
