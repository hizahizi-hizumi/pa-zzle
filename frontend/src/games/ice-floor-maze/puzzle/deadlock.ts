import type { IceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import {
  type IceFloorMazeSlide,
  iceFloorMazeDirections,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import type { IceFloorMazeState } from "@/games/ice-floor-maze/puzzle/state";
import { exploreIceFloorMazeStates } from "@/games/ice-floor-maze/puzzle/state-graph";

/**
 * 今の状態からゴールで止まれるか。
 * - `goal-reachable`: 滑りを重ねればゴールで止まれる。ゴールにいるときを含む。
 * - `goal-unreachable`: 詰み。ゴールで止まれないが、要素を変えない滑りでまだ戻れない先へ進める。
 * - `trapped`: 閉じ込め。詰みのうち、要素を変えない滑り（もろい岩を崩さず、薄い氷を割らない滑り）で行けるどの位置からも、
 *   同じ滑りで今の位置へ戻れる。崩す・割る手が残っていても、それを除けば同じところを回るだけになっている。
 *   要素の無い盤面では、行けるどの状態からも今の状態へ戻れ、その中にゴールが無いことにあたる。
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

  return canOnlyCircleWithoutChanges(board, state)
    ? "trapped"
    : "goal-unreachable";
}

function changesElements(
  slide: Extract<IceFloorMazeSlide, { status: "slid" }>,
): boolean {
  return slide.crumbledRock !== null || slide.crackedIce.length > 0;
}

/**
 * 要素を変えない滑りだけで今の位置から行けるどの位置からも、同じ滑りで今の位置へ戻れるか。
 * 要素を変えない滑りでは盤面のマスが変わらないので、今の盤面のマスのまま駒の位置だけをたどる。
 */
function canOnlyCircleWithoutChanges(
  board: IceFloorMazeBoard,
  { position: origin, cells }: IceFloorMazeState,
): boolean {
  const reached = [origin];
  const predecessorsByPosition = new Map<number, number[]>([[origin, []]]);
  for (let order = 0; order < reached.length; order += 1) {
    const position = reached[order]!;
    for (const direction of iceFloorMazeDirections) {
      const slide = slideIceFloorMazePiece(
        board,
        { position, cells },
        direction,
      );
      if (slide.status === "blocked" || changesElements(slide)) {
        continue;
      }

      let predecessors = predecessorsByPosition.get(slide.to);
      if (!predecessors) {
        predecessors = [];
        predecessorsByPosition.set(slide.to, predecessors);
        reached.push(slide.to);
      }
      predecessors.push(position);
    }
  }

  const returnable = new Set([origin]);
  const pending = [origin];
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const predecessor of predecessorsByPosition.get(current)!) {
      if (!returnable.has(predecessor)) {
        returnable.add(predecessor);
        pending.push(predecessor);
      }
    }
  }

  return returnable.size === reached.length;
}
