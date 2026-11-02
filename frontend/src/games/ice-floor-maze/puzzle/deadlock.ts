import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeState } from "@/games/ice-floor-maze/puzzle/state";
import { exploreIceFloorMazeStates } from "@/games/ice-floor-maze/puzzle/state-graph";

/** 詰み（どう滑ってもゴールで止まれない）の状態の様子。 */
export type IceFloorMazeDeadlock = {
  /** 詰みの状態から滑りを重ねて移れる状態の数。その状態自身を含む。どれも詰みの状態になる。 */
  reachableStateCount: number;
};

/**
 * 今の状態が詰みなら、その様子を返す。詰みでなければ `null`。ゴールにいるときは詰みでない。
 * 詰みの状態からどう滑っても詰みのままになる。
 *
 * プレイ中に現れる状態（問題の開始状態からゴールで止まらずに移れる状態）を判定する。そうした状態から移れる状態は
 * 開始状態から移れる状態に含まれるので、問題が状態の数の上限に収まっていれば（`assertIceFloorMazeProblem`）この判定も収まる。
 */
export function findIceFloorMazeDeadlock(
  board: IceFloorMazeBoard,
  state: IceFloorMazeState,
  goal: number,
): IceFloorMazeDeadlock | null {
  const graph = exploreIceFloorMazeStates(board, state, { goal });
  if (!graph) {
    throw new RangeError("Ice floor maze state graph exceeds the limit");
  }
  if (graph.states.some(({ position }) => position === goal)) {
    return null;
  }
  return { reachableStateCount: graph.states.length };
}
