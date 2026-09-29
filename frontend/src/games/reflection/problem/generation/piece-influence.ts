import type { ReflectionBoard } from "@/games/reflection/puzzle/board";
import {
  areSameReflectionClues,
  computeReflectionClues,
} from "@/games/reflection/puzzle/laser";

/**
 * どのピースも、取り除くと外周ヒントのどれかが変わるか。
 * 取り除いてもヒントが変わらないピースは推理の手掛かりに現れず、置き場所を決められない。
 */
export function doAllReflectionPiecesInfluenceClues(
  board: ReflectionBoard,
): boolean {
  const clues = computeReflectionClues(board);
  const cells = [...board.cells];
  return board.cells.every(function influencesClues(piece, cellIndex) {
    if (piece === null) {
      return true;
    }
    cells[cellIndex] = null;
    const cluesWithoutPiece = computeReflectionClues({
      size: board.size,
      cells,
    });
    cells[cellIndex] = piece;
    return !areSameReflectionClues(cluesWithoutPiece, clues);
  });
}
