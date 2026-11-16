import {
  countHakoiriMusumeCells,
  getHakoiriMusumeCell,
  getHakoiriMusumeCellPosition,
  type HakoiriMusumeCellPosition,
  type HakoiriMusumeLayout,
  isHakoiriMusumePieceInsideBoard,
  listHakoiriMusumePieceCells,
  listHakoiriMusumePieceCellsAt,
} from "@/games/hakoiri-musume/puzzle/board";
import type { HakoiriMusumeState } from "@/games/hakoiri-musume/puzzle/state";

export const hakoiriMusumeDirections = ["up", "right", "down", "left"] as const;

export type HakoiriMusumeDirection = (typeof hakoiriMusumeDirections)[number];

export const hakoiriMusumeStepByDirection = {
  up: { row: -1, column: 0 },
  right: { row: 0, column: 1 },
  down: { row: 1, column: 0 },
  left: { row: 0, column: -1 },
} as const satisfies Record<HakoiriMusumeDirection, HakoiriMusumeCellPosition>;

export type HakoiriMusumePlacementCheck = (
  position: HakoiriMusumeCellPosition,
) => boolean;

/** 1つの駒を続けて動かす間はほかの駒が動かないので、作り直さずに使える。 */
export function createHakoiriMusumePlacementCheck(
  layout: HakoiriMusumeLayout,
  state: HakoiriMusumeState,
  pieceIndex: number,
): HakoiriMusumePlacementCheck {
  const occupied = new Array<boolean>(countHakoiriMusumeCells(layout)).fill(
    false,
  );
  for (const wall of layout.walls) {
    occupied[wall] = true;
  }
  state.pieces.forEach((piece, index) => {
    if (index === pieceIndex) {
      return;
    }
    for (const cell of listHakoiriMusumePieceCells(layout, piece)) {
      occupied[cell] = true;
    }
  });
  const { kind } = state.pieces[pieceIndex]!;
  return function canPlace(position) {
    return (
      isHakoiriMusumePieceInsideBoard(layout, kind, position) &&
      listHakoiriMusumePieceCellsAt(layout, kind, position).every(
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

/** 動いた先が箱の外にはみ出すか、壁かほかの駒と重なるなら `null`。 */
export function moveHakoiriMusumePiece(
  layout: HakoiriMusumeLayout,
  state: HakoiriMusumeState,
  pieceIndex: number,
  direction: HakoiriMusumeDirection,
): HakoiriMusumeState | null {
  const piece = state.pieces[pieceIndex];
  if (!piece) {
    return null;
  }
  const next = shiftPosition(
    getHakoiriMusumeCellPosition(layout, piece.cell),
    direction,
  );
  return createHakoiriMusumePlacementCheck(layout, state, pieceIndex)(next)
    ? placePiece(state, pieceIndex, getHakoiriMusumeCell(layout, next))
    : null;
}

/** 今のマスは含めず、近い順（同じ近さはたどった順）に並ぶ。 */
function listHakoiriMusumePieceDestinations(
  layout: HakoiriMusumeLayout,
  state: HakoiriMusumeState,
  pieceIndex: number,
): number[] {
  const start = state.pieces[pieceIndex]!.cell;
  const canPlace = createHakoiriMusumePlacementCheck(layout, state, pieceIndex);
  const visited = new Set([start]);
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const position = getHakoiriMusumeCellPosition(layout, queue[head]!);
    for (const direction of hakoiriMusumeDirections) {
      const next = shiftPosition(position, direction);
      if (!canPlace(next)) {
        continue;
      }
      const cell = getHakoiriMusumeCell(layout, next);
      if (!visited.has(cell)) {
        visited.add(cell);
        queue.push(cell);
      }
    }
  }
  return queue.slice(1);
}

/** `cell` は `listHakoiriMusumePieceDestinations` が返したマスに限る。 */
function placeHakoiriMusumePiece(
  state: HakoiriMusumeState,
  pieceIndex: number,
  cell: number,
): HakoiriMusumeState {
  return placePiece(state, pieceIndex, cell);
}

export function isHakoiriMusumeCleared(
  layout: HakoiriMusumeLayout,
  state: HakoiriMusumeState,
): boolean {
  return layout.goals.every((goal, target) =>
    state.pieces.some(
      (piece) =>
        piece.target === target && goal.placements.includes(piece.cell),
    ),
  );
}

/** 全局面の数え上げとセッションの試験で、別の作り方と突き合わせるのに使う。 */
export const _private = {
  listHakoiriMusumePieceDestinations,
  placeHakoiriMusumePiece,
};
