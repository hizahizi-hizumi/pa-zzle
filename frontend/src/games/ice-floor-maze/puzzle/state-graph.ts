import {
  type IceFloorMazeBoard,
  isIceFloorMazeChangeableCell,
} from "@/games/ice-floor-maze/puzzle/board";
import {
  applyIceFloorMazeSlide,
  type IceFloorMazeDirection,
  iceFloorMazeDirections,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import type { IceFloorMazeState } from "@/games/ice-floor-maze/puzzle/state";

/**
 * 状態のグラフでたどる状態の数の上限。要素を崩す・割る順序の組み合わせで状態は増えるが、
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
 * 状態を表す数の、要素ごとの変化のビットの数。状態は駒の位置と各要素が変わったかで決まり、
 * `変化のビット列 × マス数 + 駒の位置` を安全な整数に収めるため、要素の数をこれまでにする。
 */
const ICE_FLOOR_MAZE_CHANGEABLE_CELL_LIMIT = 30;

/** 起点から幅優先で状態をたどる。状態の数が `limit` を超えたら `null`。 */
export function exploreIceFloorMazeStates(
  board: IceFloorMazeBoard,
  origin: IceFloorMazeState,
  {
    goal,
    limit = ICE_FLOOR_MAZE_STATE_LIMIT,
  }: IceFloorMazeStateExploration = {},
): IceFloorMazeStateGraph | null {
  const bitByCell = new Map(
    board.cells
      .flatMap((cell, cellIndex) =>
        isIceFloorMazeChangeableCell(cell) ? [cellIndex] : [],
      )
      .map((cellIndex, bitIndex) => [cellIndex, 1 << bitIndex]),
  );
  if (bitByCell.size > ICE_FLOOR_MAZE_CHANGEABLE_CELL_LIMIT) {
    throw new RangeError("Ice floor maze board has too many changeable cells");
  }

  const cellCount = board.cells.length;
  const states = [origin];
  const changeMasks = [
    board.cells.reduce(
      (mask, cell, cellIndex) =>
        cell === origin.cells[cellIndex]
          ? mask
          : mask | (bitByCell.get(cellIndex) ?? 0),
      0,
    ),
  ];
  const moveCounts = [0];
  const moves: IceFloorMazeStateMove[][] = [];
  const indexByKey = new Map([
    [changeMasks[0]! * cellCount + origin.position, 0],
  ]);

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

      const changedCells =
        slide.crumbledRock === null
          ? slide.crackedIce
          : [slide.crumbledRock, ...slide.crackedIce];
      const changeMask = changedCells.reduce(
        (mask, cellIndex) => mask | bitByCell.get(cellIndex)!,
        changeMasks[order]!,
      );
      const key = changeMask * cellCount + slide.to;
      let to = indexByKey.get(key);
      if (to === undefined) {
        to = states.length;
        if (to >= limit) {
          return null;
        }
        indexByKey.set(key, to);
        states.push(applyIceFloorMazeSlide(state, slide));
        changeMasks.push(changeMask);
        moveCounts.push(moveCounts[order]! + 1);
      }
      stateMoves.push({ direction, to });
    }
  }

  return { states, moveCounts, moves };
}
