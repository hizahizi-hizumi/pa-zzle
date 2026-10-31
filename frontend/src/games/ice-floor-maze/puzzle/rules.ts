import {
  getIceFloorMazeCellPosition,
  type IceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";

export const iceFloorMazeDirections = ["up", "right", "down", "left"] as const;

/** 駒を滑らせる向き。 */
export type IceFloorMazeDirection = (typeof iceFloorMazeDirections)[number];

/**
 * 1回の滑りの結果。
 * - `slid`: 1マス以上進んで止まった。`path` は動き出してから入ったマスの並びで、最後が止まったマス `to`。
 * - `blocked`: すぐ隣が岩か外壁で、1マスも動けない。移動として成立しない。
 */
export type IceFloorMazeSlide =
  | {
      status: "slid";
      direction: IceFloorMazeDirection;
      from: number;
      to: number;
      path: readonly number[];
    }
  | {
      status: "blocked";
      direction: IceFloorMazeDirection;
      from: number;
    };

const stepByDirection = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
} as const satisfies Record<IceFloorMazeDirection, { x: number; y: number }>;

/** 隣のマスの番号。盤面の外（外壁）なら `null`。 */
export function getIceFloorMazeNeighbor(
  board: IceFloorMazeBoard,
  cellIndex: number,
  direction: IceFloorMazeDirection,
): number | null {
  const { x, y } = getIceFloorMazeCellPosition(board, cellIndex);
  const step = stepByDirection[direction];
  const nextX = x + step.x;
  const nextY = y + step.y;
  if (nextX < 0 || nextX >= board.width || nextY < 0 || nextY >= board.height) {
    return null;
  }
  return nextY * board.width + nextX;
}

/** 駒を `from` から `direction` へ、岩か外壁にぶつかるまで滑らせる。途中で止まる位置は選べない。 */
export function slideIceFloorMazePiece(
  board: IceFloorMazeBoard,
  from: number,
  direction: IceFloorMazeDirection,
): IceFloorMazeSlide {
  const path: number[] = [];
  let current = from;
  while (true) {
    const next = getIceFloorMazeNeighbor(board, current, direction);
    if (next === null || board.cells[next] === "rock") {
      break;
    }
    path.push(next);
    current = next;
  }

  if (path.length === 0) {
    return { status: "blocked", direction, from };
  }
  return { status: "slid", direction, from, to: current, path };
}

/** ゴールで止まったときだけクリアになる。滑りの途中でゴールを通っただけではクリアにならない。 */
export function isIceFloorMazeCleared(position: number, goal: number): boolean {
  return position === goal;
}

/** 止まらずにゴールを通り過ぎた滑りか。 */
export function doesIceFloorMazeSlidePassGoal(
  slide: IceFloorMazeSlide,
  goal: number,
): boolean {
  return (
    slide.status === "slid" && slide.to !== goal && slide.path.includes(goal)
  );
}
