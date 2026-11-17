import {
  type IceFloorMazeBoard,
  parseIceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import type { IceFloorMazeDirection } from "@/games/ice-floor-maze/puzzle/rules";
import type { IceFloorMazeState } from "@/games/ice-floor-maze/puzzle/state";
import {
  createIceFloorMazeSession,
  type IceFloorMazeSession,
  slideIceFloorMazeSessionPiece,
  undoIceFloorMazeSession,
} from "@/games/ice-floor-maze/session/session";

/** 手数の数え方を見せる流れの、1つの操作。 */
export type IceFloorMazeMoveCountStep =
  | { kind: "slide"; direction: IceFloorMazeDirection }
  | { kind: "undo" };

/** 流れのコマ1つ。`trail` は、そのコマへ移った滑りの跡。滑りで移ったのでなければ `null`。 */
type IceFloorMazeMoveCountFrame = {
  state: IceFloorMazeState;
  trail: { direction: IceFloorMazeDirection; from: number } | null;
};

/** 手数の数え方を見せる流れ。`moveCount` は、流れの手を本番のセッションで打ち終えた後の手数。 */
export type IceFloorMazeMoveCountFlow = {
  steps: readonly IceFloorMazeMoveCountStep[];
  frames: readonly IceFloorMazeMoveCountFrame[];
  moveCount: number;
};

/**
 * 流れの図の盤面。本番のセッションが受ける最も小さい形（3マス四方）の氷にし、駒は右上から始める。
 * 左へは滑り、右へは壁で動けない。ゴールは問題の形に要るだけで、手数の数え方には関わらないので、図には描かない。
 */
export const moveCountFlowBoard: IceFloorMazeBoard = parseIceFloorMazeBoard([
  "...",
  "...",
  "...",
]);

const flowProblem = { board: moveCountFlowBoard, start: 2, goal: 6 };

/** 操作の流れを、本番のセッションで始まりから順に打ち、手ごとのコマと、打ち終えた後の手数にする。 */
function createMoveCountFlow(
  steps: readonly IceFloorMazeMoveCountStep[],
): IceFloorMazeMoveCountFlow {
  let session: IceFloorMazeSession = createIceFloorMazeSession(flowProblem, 0);
  const frames: IceFloorMazeMoveCountFrame[] = [
    { state: session.puzzleState, trail: null },
  ];
  for (const step of steps) {
    if (step.kind === "undo") {
      session = undoIceFloorMazeSession(session);
      frames.push({ state: session.puzzleState, trail: null });
      continue;
    }
    const attempt = slideIceFloorMazeSessionPiece(session, step.direction, 0);
    session = attempt.session;
    frames.push({
      state: session.puzzleState,
      trail:
        attempt.outcome === "slid"
          ? { direction: attempt.slide.direction, from: attempt.slide.from }
          : null,
    });
  }
  return { steps, frames, moveCount: session.moveCount };
}

/**
 * 滑らせてから待ったで取り消す流れと、1マスも動けない向きを選ぶ流れ。
 * 矢印の言葉で向きを言うので、動けない流れの前後のコマが同じ姿でも、どの向きを試したかが読める。
 */
export const moveCountFlows = {
  undo: createMoveCountFlow([
    { kind: "slide", direction: "left" },
    { kind: "undo" },
  ]),
  blocked: createMoveCountFlow([{ kind: "slide", direction: "right" }]),
} as const;
