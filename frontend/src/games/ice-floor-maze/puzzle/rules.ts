import {
  getIceFloorMazeCellPosition,
  type IceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import type {
  IceFloorMazeState,
  IceFloorMazeStateCell,
} from "@/games/ice-floor-maze/puzzle/state";

export const iceFloorMazeDirections = ["up", "right", "down", "left"] as const;

/** 駒を滑らせる向き。 */
export type IceFloorMazeDirection = (typeof iceFloorMazeDirections)[number];

/**
 * 1回の滑りの結果。
 * - `slid`: 1マス以上進んで止まった。`path` は動き出してから入ったマスの並びで、最後が止まったマス `to`。
 *   `crumbledRock` はこの滑りの後で崩れるもろい岩のマス、`crackedIce` は割れて水面になる薄い氷のマス（出発マスと通過したマス）。
 *   滑りの後の状態は `applyIceFloorMazeSlide` で求める。
 * - `blocked`: すぐ隣が止め役か外壁で、1マスも動けない。移動として成立せず、どの要素も変わらない。
 */
export type IceFloorMazeSlide =
  | {
      status: "slid";
      direction: IceFloorMazeDirection;
      from: number;
      to: number;
      path: readonly number[];
      crumbledRock: number | null;
      crackedIce: readonly number[];
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

const stopperCells: ReadonlySet<IceFloorMazeStateCell> = new Set([
  "rock",
  "brittle-rock",
  "water",
  "outside",
]);

/** 駒がその手前で止まるマスか。岩・もろい岩・水面・盤面の外。 */
export function isIceFloorMazeStopperCell(
  cell: IceFloorMazeStateCell,
): boolean {
  return stopperCells.has(cell);
}

/** 隣のマスの番号。外周の外壁なら `null`。 */
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

/**
 * 駒を `direction` へ、止め役か外壁にぶつかるまで滑らせる。途中で止まる位置は選べない。
 * 止めたのがもろい岩ならそれが崩れ、出発マスと通過したマスのうち薄い氷だったものが割れる。止まったマスは割れない。
 */
export function slideIceFloorMazePiece(
  board: IceFloorMazeBoard,
  state: IceFloorMazeState,
  direction: IceFloorMazeDirection,
): IceFloorMazeSlide {
  const { position: from, cells } = state;
  const path: number[] = [];
  let current = from;
  let stopper = getIceFloorMazeNeighbor(board, current, direction);
  while (stopper !== null && !isIceFloorMazeStopperCell(cells[stopper]!)) {
    path.push(stopper);
    current = stopper;
    stopper = getIceFloorMazeNeighbor(board, current, direction);
  }

  if (path.length === 0) {
    return { status: "blocked", direction, from };
  }

  const crackedIce: number[] = [];
  for (const left of [from, ...path.slice(0, -1)]) {
    if (cells[left] === "thin-ice") {
      crackedIce.push(left);
    }
  }
  return {
    status: "slid",
    direction,
    from,
    to: current,
    path,
    crumbledRock:
      stopper !== null && cells[stopper] === "brittle-rock" ? stopper : null,
    crackedIce,
  };
}

/** 成立した滑りの後の状態。もろい岩が崩れて氷に、薄い氷が割れて水面になる。どの要素も変わらなければ盤面のマスの配列を共有する。 */
export function applyIceFloorMazeSlide(
  state: IceFloorMazeState,
  slide: Extract<IceFloorMazeSlide, { status: "slid" }>,
): IceFloorMazeState {
  const { crumbledRock, crackedIce } = slide;
  if (crumbledRock === null && crackedIce.length === 0) {
    return { position: slide.to, cells: state.cells };
  }

  const cells = [...state.cells];
  if (crumbledRock !== null) {
    cells[crumbledRock] = "ice";
  }
  for (const cellIndex of crackedIce) {
    cells[cellIndex] = "water";
  }
  return { position: slide.to, cells };
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
