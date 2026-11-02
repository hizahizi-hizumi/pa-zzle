import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeState } from "@/games/ice-floor-maze/puzzle/state";
import { exploreIceFloorMazeStates } from "@/games/ice-floor-maze/puzzle/state-graph";

/**
 * 今の状態が詰み（どう滑ってもゴールで止まれない）か。ゴールにいるときは詰みでない。
 * 詰みの状態からどう滑っても詰みのままになる。
 *
 * プレイ中に現れる状態（問題の開始状態からゴールで止まらずに移れる状態）を判定する。そうした状態から移れる状態は
 * 開始状態から移れる状態に含まれるので、問題が状態の数の上限に収まっていれば（`assertIceFloorMazeProblem`）この判定も収まる。
 */
export function isIceFloorMazeDeadlocked(
  board: IceFloorMazeBoard,
  state: IceFloorMazeState,
  goal: number,
): boolean {
  const graph = exploreIceFloorMazeStates(board, state, { goal });
  if (!graph) {
    throw new RangeError("Ice floor maze state graph exceeds the limit");
  }
  return !graph.states.some(({ position }) => position === goal);
}
