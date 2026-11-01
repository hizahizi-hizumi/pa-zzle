import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeState } from "@/games/ice-floor-maze/puzzle/state";
import { exploreIceFloorMazeStates } from "@/games/ice-floor-maze/puzzle/state-graph";

/**
 * 今の状態からゴールで止まれるか。
 * - `goal-reachable`: 滑りを重ねればゴールで止まれる。ゴールにいるときを含む。
 * - `goal-unreachable`: 詰み。ゴールで止まれないが、まだ戻れない先へ進める手がある。
 * - `trapped`: 閉じ込め。詰みのうち、行けるどの状態からも今の状態へ戻れ、その中にゴールが無い。
 *   状態のグラフで、今の状態の強連結成分が出口を持たずゴールを含まないことにあたる。
 *   もろい岩を崩す・薄い氷を割る手は戻れないので、そうした手が残る間は閉じ込めにならない。
 */
export type IceFloorMazeDeadlockStatus =
  | "goal-reachable"
  | "goal-unreachable"
  | "trapped";

/**
 * プレイ中に現れる状態（問題の開始状態からゴールで止まらずに移れる状態）を判定する。そうした状態から移れる状態は
 * 開始状態から移れる状態に含まれるので、問題が状態の数の上限に収まっていれば（`assertIceFloorMazeProblem`）この判定も収まる。
 */
export function classifyIceFloorMazeDeadlock(
  board: IceFloorMazeBoard,
  state: IceFloorMazeState,
  goal: number,
): IceFloorMazeDeadlockStatus {
  const graph = exploreIceFloorMazeStates(board, state, { goal });
  if (!graph) {
    throw new RangeError("Ice floor maze state graph exceeds the limit");
  }
  if (graph.states.some(({ position }) => position === goal)) {
    return "goal-reachable";
  }

  const predecessors = graph.states.map((): number[] => []);
  for (const [from, stateMoves] of graph.moves.entries()) {
    for (const { to } of stateMoves) {
      predecessors[to]!.push(from);
    }
  }

  const origin = 0;
  const returnable = new Set([origin]);
  const pending = [origin];
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const predecessor of predecessors[current]!) {
      if (!returnable.has(predecessor)) {
        returnable.add(predecessor);
        pending.push(predecessor);
      }
    }
  }

  return returnable.size === graph.states.length
    ? "trapped"
    : "goal-unreachable";
}
