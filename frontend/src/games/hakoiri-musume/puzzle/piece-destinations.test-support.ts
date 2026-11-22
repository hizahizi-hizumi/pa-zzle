import {
  getHakoiriMusumeCell,
  getHakoiriMusumeCellPosition,
  type HakoiriMusumeLayout,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  createHakoiriMusumePlacementCheck,
  hakoiriMusumeDirections,
  hakoiriMusumeStepByDirection,
} from "@/games/hakoiri-musume/puzzle/rules";
import type { HakoiriMusumeState } from "@/games/hakoiri-musume/puzzle/state";

// 全局面の数え上げとセッションの試験で、1マスずつの移動とは別の作り方の1手として突き合わせる。

/** 今のマスは含めず、近い順（同じ近さはたどった順）に並ぶ。 */
export function listHakoiriMusumePieceDestinations(
  layout: HakoiriMusumeLayout,
  state: HakoiriMusumeState,
  pieceIndex: number,
): number[] {
  const start = state.pieces[pieceIndex]!.cell;
  const canPlace = createHakoiriMusumePlacementCheck(layout, state, pieceIndex);
  const visited = new Set([start]);
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const { row, column } = getHakoiriMusumeCellPosition(layout, queue[head]!);
    for (const direction of hakoiriMusumeDirections) {
      const step = hakoiriMusumeStepByDirection[direction];
      const next = { row: row + step.row, column: column + step.column };
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
export function placeHakoiriMusumePiece(
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
