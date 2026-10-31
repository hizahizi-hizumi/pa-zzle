import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import {
  exploreIceFloorMazeStops,
  listIceFloorMazeStopMoves,
} from "@/games/ice-floor-maze/puzzle/stop-graph";

/**
 * 駒の位置からゴールで止まれるか。
 * - `goal-reachable`: 滑りを重ねればゴールで止まれる。ゴールにいるときを含む。
 * - `goal-unreachable`: 詰み。ゴールで止まれないが、まだ戻れない先へ進める手がある。
 * - `trapped`: 閉じ込め。詰みのうち、行けるどの位置からも今の位置へ戻れ、その中にゴールが無い。
 *   停止点の移動のグラフで、今の位置の強連結成分が出口を持たずゴールを含まないことにあたる。
 */
export type IceFloorMazeDeadlockStatus =
  | "goal-reachable"
  | "goal-unreachable"
  | "trapped";

export function classifyIceFloorMazeDeadlock(
  board: IceFloorMazeBoard,
  position: number,
  goal: number,
): IceFloorMazeDeadlockStatus {
  const graph = exploreIceFloorMazeStops(board, position);
  if (graph.moveCounts.has(goal)) {
    return "goal-reachable";
  }

  const predecessors = new Map<number, number[]>(
    graph.stops.map((stop) => [stop, []]),
  );
  for (const stop of graph.stops) {
    for (const move of listIceFloorMazeStopMoves(graph, stop)) {
      predecessors.get(move.to)!.push(stop);
    }
  }

  const returnable = new Set([position]);
  const pending = [position];
  while (pending.length > 0) {
    const stop = pending.pop()!;
    for (const predecessor of predecessors.get(stop)!) {
      if (!returnable.has(predecessor)) {
        returnable.add(predecessor);
        pending.push(predecessor);
      }
    }
  }

  return returnable.size === graph.stops.length
    ? "trapped"
    : "goal-unreachable";
}
