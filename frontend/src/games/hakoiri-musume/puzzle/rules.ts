import {
  getHakoiriMusumeCell,
  getHakoiriMusumeCellPosition,
  HAKOIRI_MUSUME_CELL_COUNT,
  HAKOIRI_MUSUME_GOAL_CELL,
  type HakoiriMusumeCellPosition,
  isHakoiriMusumePieceInsideBoard,
  listHakoiriMusumePieceCells,
  listHakoiriMusumePieceCellsAt,
} from "@/games/hakoiri-musume/puzzle/board";
import type { HakoiriMusumeState } from "@/games/hakoiri-musume/puzzle/state";

export const hakoiriMusumeDirections = ["up", "right", "down", "left"] as const;

/** 駒を1マス動かす向き。 */
export type HakoiriMusumeDirection = (typeof hakoiriMusumeDirections)[number];

export const hakoiriMusumeStepByDirection = {
  up: { row: -1, column: 0 },
  right: { row: 0, column: 1 },
  down: { row: 1, column: 0 },
  left: { row: 0, column: -1 },
} as const satisfies Record<HakoiriMusumeDirection, HakoiriMusumeCellPosition>;

/** 駒の左上を `position` に置けるかを確かめる関数。 */
export type HakoiriMusumePlacementCheck = (
  position: HakoiriMusumeCellPosition,
) => boolean;

/**
 * 盤面の `pieceIndex` 番目の駒を、ほかの駒をそのままにして左上を `position` に置けるかを確かめる関数を作る。
 * 箱の内側に収まり、ほかの駒と重ならない位置だけを置けるとする。1つの駒を続けて動かす間はほかの駒が動かないので、作り直さずに使える。
 */
export function createHakoiriMusumePlacementCheck(
  state: HakoiriMusumeState,
  pieceIndex: number,
): HakoiriMusumePlacementCheck {
  const occupied = new Array<boolean>(HAKOIRI_MUSUME_CELL_COUNT).fill(false);
  state.pieces.forEach((piece, index) => {
    if (index === pieceIndex) {
      return;
    }
    for (const cell of listHakoiriMusumePieceCells(piece)) {
      occupied[cell] = true;
    }
  });
  const { kind } = state.pieces[pieceIndex]!;
  return function canPlace(position) {
    return (
      isHakoiriMusumePieceInsideBoard(kind, position) &&
      listHakoiriMusumePieceCellsAt(kind, position).every(
        (cell) => !occupied[cell],
      )
    );
  };
}

function shiftPosition(
  { row, column }: HakoiriMusumeCellPosition,
  direction: HakoiriMusumeDirection,
): HakoiriMusumeCellPosition {
  const step = hakoiriMusumeStepByDirection[direction];
  return { row: row + step.row, column: column + step.column };
}

function placePiece(
  state: HakoiriMusumeState,
  pieceIndex: number,
  cell: number,
): HakoiriMusumeState {
  return {
    pieces: state.pieces.map((piece, index) =>
      index === pieceIndex ? { ...piece, cell } : piece,
    ),
  };
}

/**
 * 駒を `direction` へ1マス動かした盤面。動いた先が箱の外にはみ出すか、ほかの駒と重なるなら `null`。
 */
export function moveHakoiriMusumePiece(
  state: HakoiriMusumeState,
  pieceIndex: number,
  direction: HakoiriMusumeDirection,
): HakoiriMusumeState | null {
  const piece = state.pieces[pieceIndex];
  if (!piece) {
    return null;
  }
  const next = shiftPosition(
    getHakoiriMusumeCellPosition(piece.cell),
    direction,
  );
  return createHakoiriMusumePlacementCheck(state, pieceIndex)(next)
    ? placePiece(state, pieceIndex, getHakoiriMusumeCell(next))
    : null;
}

/**
 * 1手で駒が行ける左上のマス。ほかの駒を動かさずに、空いたマスを1マスずつ何回曲がってもたどれる所で、
 * 今のマスは含めない。近い順（同じ近さはたどった順）に並ぶ。
 */
export function listHakoiriMusumePieceDestinations(
  state: HakoiriMusumeState,
  pieceIndex: number,
): number[] {
  const start = state.pieces[pieceIndex]!.cell;
  const canPlace = createHakoiriMusumePlacementCheck(state, pieceIndex);
  const visited = new Set([start]);
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const position = getHakoiriMusumeCellPosition(queue[head]!);
    for (const direction of hakoiriMusumeDirections) {
      const next = shiftPosition(position, direction);
      if (!canPlace(next)) {
        continue;
      }
      const cell = getHakoiriMusumeCell(next);
      if (!visited.has(cell)) {
        visited.add(cell);
        queue.push(cell);
      }
    }
  }
  return queue.slice(1);
}

/** 1手で駒を `cell` へ動かした盤面。`cell` は `listHakoiriMusumePieceDestinations` が返したマスに限る。 */
export function placeHakoiriMusumePiece(
  state: HakoiriMusumeState,
  pieceIndex: number,
  cell: number,
): HakoiriMusumeState {
  return placePiece(state, pieceIndex, cell);
}

/** 娘の左上が出口の前のマスにあればクリア。娘がどう動いてきたかは問わない。 */
export function isHakoiriMusumeCleared(state: HakoiriMusumeState): boolean {
  return state.pieces.some(
    (piece) =>
      piece.kind === "daughter" && piece.cell === HAKOIRI_MUSUME_GOAL_CELL,
  );
}
