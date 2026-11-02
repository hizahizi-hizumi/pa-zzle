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

/** 雪を押し出した、または滑る氷の塊を動かしたときの、元のマス `from` と動いた先のマス `to`。 */
export type IceFloorMazeShift = { from: number; to: number };

/**
 * 1回の滑りの結果。
 * - `slid`: 1マス以上進んで止まった。`path` は動き出してから入ったマスの並びで、最後が止まったマス `to`。
 *   `crumbledRock` はこの滑りの後で崩れるもろい岩のマス、`crackedIce` は割れて水面になる薄い氷のマス（出発マスと通過したマス）。
 *   `pushedSnow` は押し出した雪（雪のマスから雪山になるマスへ）、`movedBlock` は押して動かした滑る氷の塊。
 *   滑りの後の状態は `applyIceFloorMazeSlide` で求める。
 * - `blocked`: すぐ隣が止め役か外壁（押し出せない雪・隣に接した塊を含む）で、1マスも動けない。移動として成立せず、どの要素も変わらない。
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

/**
 * 駒がその手前で止まるマスか。岩・もろい岩・水面・雪山・盤面の外。床と雪は入って止まるマスで、止め役ではない。
 * 滑る氷の塊はマスではなく状態の `blocks` で持つので、`isIceFloorMazeBlockedCell` で確かめる。
 */
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

/** 状態 `state` で、駒・雪・滑る氷の塊がそのマスへ入れないか。止め役のマスか、塊のあるマス。 */
export function isIceFloorMazeBlockedCell(
  state: Pick<IceFloorMazeState, "cells" | "blocks">,
  cellIndex: number,
): boolean {
  return (
    isIceFloorMazeStopperCell(state.cells[cellIndex]!) ||
    state.blocks.includes(cellIndex)
  );
}

/** 押し出した雪・押した塊が入って進めるマスか。氷か薄い氷で、塊が無い。床・雪・止め役・塊のあるマスでは手前で止まる。 */
function isOpenForShift(state: IceFloorMazeState, cellIndex: number): boolean {
  const cell = state.cells[cellIndex];
  return (
    (cell === "ice" || cell === "thin-ice") && !state.blocks.includes(cellIndex)
  );
}

/** 押した塊が `direction` へ滑って止まるマス。1マスも動けなければ `block`。 */
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

/**
 * 駒を `direction` へ、止め役か外壁にぶつかるか、床に入るまで滑らせる。途中で止まる位置は選べない。
 * 止めたのがもろい岩ならそれが崩れ、出発マスと通過したマスのうち薄い氷だったものが割れる。止まったマスは割れない。
 * 床に入って止まったときは、その先のマスにはぶつかっていないので、先がもろい岩でも崩れない。
 * 雪に滑り込むと、雪の先が氷か薄い氷なら雪をそこへ押し出して雪のマスで止まり、そうでなければ雪の手前で止まる。
 * 1マス以上滑って滑る氷の塊にぶつかると、塊が次の止め役の手前まで滑り、駒は塊と一緒に進んでその手前で止まる。
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

/** 滑りで盤面のマスか塊の位置が変わるか（もろい岩が崩れる・薄い氷が割れる・雪を押し出す・塊が動く）。 */
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

/**
 * 成立した滑りの後の状態。もろい岩が崩れて氷に、薄い氷が割れて水面に、押し出した雪のマスが氷に、押し出した先が雪山になり、
 * 押した塊が動く。どの要素も変わらなければ盤面のマスの配列と塊の並びを共有する。
 */
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
