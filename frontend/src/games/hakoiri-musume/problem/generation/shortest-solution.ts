import {
  formatHakoiriMusumeBoard,
  type HakoiriMusumePiece,
} from "@/games/hakoiri-musume/puzzle/board";
import {
  isHakoiriMusumeCleared,
  listHakoiriMusumePieceDestinations,
  placeHakoiriMusumePiece,
} from "@/games/hakoiri-musume/puzzle/rules";
import {
  createHakoiriMusumeInitialState,
  type HakoiriMusumeState,
} from "@/games/hakoiri-musume/puzzle/state";

/**
 * 始めの並びから娘を出口の前へ運ぶ最短手数。1手は1つの駒を空いたマスの続く所へ動かすこと（同じ駒を続けて動かした分）。
 * 盤面を20文字で見分けるので、同じ種類の駒どうしが入れ替わっただけの盤面は同じ盤面として1回だけたどる。
 * 娘を出口の前へ運べなければ `null`。
 */
export function measureHakoiriMusumeOptimalMoveCount(
  pieces: readonly HakoiriMusumePiece[],
): number | null {
  const start = createHakoiriMusumeInitialState(pieces);
  const visited = new Set([formatHakoiriMusumeBoard(start.pieces)]);
  let frontier: HakoiriMusumeState[] = [start];
  for (let moveCount = 0; frontier.length > 0; moveCount += 1) {
    if (frontier.some(isHakoiriMusumeCleared)) {
      return moveCount;
    }
    const next: HakoiriMusumeState[] = [];
    for (const state of frontier) {
      state.pieces.forEach((_, pieceIndex) => {
        for (const cell of listHakoiriMusumePieceDestinations(
          state,
          pieceIndex,
        )) {
          const moved = placeHakoiriMusumePiece(state, pieceIndex, cell);
          const key = formatHakoiriMusumeBoard(moved.pieces);
          if (!visited.has(key)) {
            visited.add(key);
            next.push(moved);
          }
        }
      });
    }
    frontier = next;
  }
  return null;
}
