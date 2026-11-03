import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import {
  applyIceFloorMazeSlide,
  doesIceFloorMazeSlideChangeElements,
  type IceFloorMazeDirection,
  iceFloorMazeDirections,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import type { IceFloorMazeState } from "@/games/ice-floor-maze/puzzle/state";

/**
 * 状態のグラフでたどる状態の数の上限。要素を崩す・割る・押し出す・動かす順序の組み合わせで状態は増えるが、
 * 研究用の生成 v4 の試遊候補では最大 3,173 状態で、v4 と同じ上限で打ち切る。
 */
export const ICE_FLOOR_MAZE_STATE_LIMIT = 20_000;

/** 状態から1回の滑りで移れる状態。`to` は `IceFloorMazeStateGraph` の `states` の番号。 */
export type IceFloorMazeStateMove = {
  direction: IceFloorMazeDirection;
  to: number;
};

/**
 * 起点から滑りを重ねて移れる状態と、その間の移動。状態の番号は `states` の添字で、0 が起点。
 * - `states`: 起点からの最少手数の昇順。
 * - `moveCounts`: 状態ごとの、起点から移るまでの最少手数。
 * - `moves`: 状態ごとの、成立した滑りで移れる状態。上・右・下・左の順。ゴールで止まった状態は手を持たない。
 */
export type IceFloorMazeStateGraph = {
  states: readonly IceFloorMazeState[];
  moveCounts: readonly number[];
  moves: readonly (readonly IceFloorMazeStateMove[])[];
};

type IceFloorMazeStateExploration = {
  /** 駒がここで止まった状態をクリアとして、その先をたどらない。 */
  goal?: number;
  limit?: number;
};

/**
 * 盤面のマスと塊の位置の組（配置）を表す文字列。状態は駒の位置と配置で決まる。要素が変わらない滑りでは配置も変わらないので、
 * 要素が変わる滑りでだけ作る。
 */
function describeLayout({ cells, blocks }: IceFloorMazeState): string {
  return `${cells.join(",")}|${blocks.join(",")}`;
}

/** 起点から幅優先で状態をたどる。状態の数が `limit` を超えたら `null`。 */
export function exploreIceFloorMazeStates(
  board: IceFloorMazeBoard,
  origin: IceFloorMazeState,
  {
    goal,
    limit = ICE_FLOOR_MAZE_STATE_LIMIT,
  }: IceFloorMazeStateExploration = {},
): IceFloorMazeStateGraph | null {
  const cellCount = board.cells.length;
  const states = [origin];
  const layouts = [0];
  const layoutByKey = new Map([[describeLayout(origin), 0]]);
  const moveCounts = [0];
  const moves: IceFloorMazeStateMove[][] = [];
  const indexByKey = new Map([[origin.position, 0]]);

  for (let order = 0; order < states.length; order += 1) {
    const state = states[order]!;
    const stateMoves: IceFloorMazeStateMove[] = [];
    moves.push(stateMoves);
    if (state.position === goal) {
      continue;
    }

    for (const direction of iceFloorMazeDirections) {
      const slide = slideIceFloorMazePiece(board, state, direction);
      if (slide.status === "blocked") {
        continue;
      }

      const changes = doesIceFloorMazeSlideChangeElements(slide);
      const next = changes ? applyIceFloorMazeSlide(state, slide) : null;
      let layout = layouts[order]!;
      if (next) {
        const layoutKey = describeLayout(next);
        layout = layoutByKey.get(layoutKey) ?? layoutByKey.size;
        layoutByKey.set(layoutKey, layout);
      }
      const key = layout * cellCount + slide.to;
      let to = indexByKey.get(key);
      if (to === undefined) {
        to = states.length;
        if (to >= limit) {
          return null;
        }
        indexByKey.set(key, to);
        states.push(next ?? applyIceFloorMazeSlide(state, slide));
        layouts.push(layout);
        moveCounts.push(moveCounts[order]! + 1);
      }
      stateMoves.push({ direction, to });
    }
  }

  return { states, moveCounts, moves };
}
