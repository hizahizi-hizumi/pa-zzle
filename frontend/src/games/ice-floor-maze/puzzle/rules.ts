import {
  getIceFloorMazeCellPosition,
  type IceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import type {
  IceFloorMazeState,
  IceFloorMazeStateCell,
} from "@/games/ice-floor-maze/puzzle/state";

export const iceFloorMazeDirections = ["up", "right", "down", "left"] as const;

export type IceFloorMazeDirection = (typeof iceFloorMazeDirections)[number];

export type IceFloorMazeShift = { from: number; to: number };

/**
 * - `slid`: 1マス以上進んで止まった。`path` は動き出してから入ったマスの並びで、最後が止まったマス `to`。
 *   `crumbledRock` はこの滑りの後で崩れるもろい岩のマス、`crackedIce` は割れて水面になる薄い氷のマス（出発マスと通過したマス）。
 *   `pushedSnow` は押し出した雪（雪のマスから雪山になるマスへ）、`movedBlock` は押して動かした滑る氷の塊。
 * - `blocked`: すぐ隣が止め役か外壁（押し出せない雪・隣に接した塊を含む）で、1マスも動けない。
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
      pushedSnow: IceFloorMazeShift | null;
      movedBlock: IceFloorMazeShift | null;
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
  "snow-mound",
]);

/** 滑る氷の塊はマスではなく状態の `blocks` で持つので、`isIceFloorMazeBlockedCell` で確かめる。 */
export function isIceFloorMazeStopperCell(
  cell: IceFloorMazeStateCell,
): boolean {
  return stopperCells.has(cell);
}

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

export function isIceFloorMazeBlockedCell(
  state: Pick<IceFloorMazeState, "cells" | "blocks">,
  cellIndex: number,
): boolean {
  return (
    isIceFloorMazeStopperCell(state.cells[cellIndex]!) ||
    state.blocks.includes(cellIndex)
  );
}

function isOpenForShift(state: IceFloorMazeState, cellIndex: number): boolean {
  const cell = state.cells[cellIndex];
  return (
    (cell === "ice" || cell === "thin-ice") && !state.blocks.includes(cellIndex)
  );
}

function findBlockStop(
  board: IceFloorMazeBoard,
  state: IceFloorMazeState,
  block: number,
  direction: IceFloorMazeDirection,
): number {
  let current = block;
  for (
    let next = getIceFloorMazeNeighbor(board, current, direction);
    next !== null && isOpenForShift(state, next);
    next = getIceFloorMazeNeighbor(board, current, direction)
  ) {
    current = next;
  }
  return current;
}

export function slideIceFloorMazePiece(
  board: IceFloorMazeBoard,
  state: IceFloorMazeState,
  direction: IceFloorMazeDirection,
): IceFloorMazeSlide {
  const { position: from, cells } = state;
  const path: number[] = [];
  let current = from;
  let stopper = getIceFloorMazeNeighbor(board, current, direction);
  let pushedSnow: IceFloorMazeShift | null = null;
  let movedBlock: IceFloorMazeShift | null = null;
  while (stopper !== null && !isIceFloorMazeBlockedCell(state, stopper)) {
    const cell = cells[stopper];
    if (cell === "snow") {
      const ahead = getIceFloorMazeNeighbor(board, stopper, direction);
      if (ahead === null || !isOpenForShift(state, ahead)) {
        break;
      }
      pushedSnow = { from: stopper, to: ahead };
    }
    path.push(stopper);
    current = stopper;
    if (cell === "floor" || cell === "snow") {
      stopper = null;
      break;
    }
    stopper = getIceFloorMazeNeighbor(board, current, direction);
  }

  if (path.length === 0) {
    return { status: "blocked", direction, from };
  }

  if (stopper !== null && state.blocks.includes(stopper)) {
    const blockStop = findBlockStop(board, state, stopper, direction);
    if (blockStop !== stopper) {
      movedBlock = { from: stopper, to: blockStop };
      while (current !== blockStop) {
        current = getIceFloorMazeNeighbor(board, current, direction)!;
        path.push(current);
      }
      path.pop();
      current = path.at(-1)!;
      stopper = blockStop;
    }
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
    pushedSnow,
    movedBlock,
  };
}

export function doesIceFloorMazeSlideChangeElements(
  slide: Extract<IceFloorMazeSlide, { status: "slid" }>,
): boolean {
  return (
    slide.crumbledRock !== null ||
    slide.crackedIce.length > 0 ||
    slide.pushedSnow !== null ||
    slide.movedBlock !== null
  );
}

/** どの要素も変わらなければ盤面のマスの配列と塊の並びを共有する。 */
export function applyIceFloorMazeSlide(
  state: IceFloorMazeState,
  slide: Extract<IceFloorMazeSlide, { status: "slid" }>,
): IceFloorMazeState {
  const { crumbledRock, crackedIce, pushedSnow, movedBlock } = slide;
  const blocks = movedBlock
    ? state.blocks
        .map((block) => (block === movedBlock.from ? movedBlock.to : block))
        .sort((left, right) => left - right)
    : state.blocks;
  if (crumbledRock === null && crackedIce.length === 0 && !pushedSnow) {
    return { position: slide.to, cells: state.cells, blocks };
  }

  const cells = [...state.cells];
  if (crumbledRock !== null) {
    cells[crumbledRock] = "ice";
  }
  for (const cellIndex of crackedIce) {
    cells[cellIndex] = "water";
  }
  if (pushedSnow) {
    cells[pushedSnow.from] = "ice";
    cells[pushedSnow.to] = "snow-mound";
  }
  return { position: slide.to, cells, blocks };
}

export function isIceFloorMazeCleared(position: number, goal: number): boolean {
  return position === goal;
}

export function doesIceFloorMazeSlidePassGoal(
  slide: IceFloorMazeSlide,
  goal: number,
): boolean {
  return (
    slide.status === "slid" && slide.to !== goal && slide.path.includes(goal)
  );
}
