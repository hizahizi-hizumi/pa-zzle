import {
  areHamiltonianPathCellsAdjacent,
  type HamiltonianPathBoard,
  hasHamiltonianPathPartition,
  isHamiltonianPathCellOnBoard,
  isHamiltonianPathWall,
} from "@/games/hamiltonian-path/puzzle/board";
import {
  getHamiltonianPathHead,
  type HamiltonianPathPuzzleState,
} from "@/games/hamiltonian-path/puzzle/state";

/**
 * 道を延ばせなかった理由。盤面の反応（阻んだ仕切りの強調、先端の揺れ）を選ぶために返す。
 * - `outside-board`: 盤面の外のマス。
 * - `not-adjacent`: 先端の上下左右に隣り合わないマス（先端そのものを含む）。
 * - `wall`: 壁マス。
 * - `partition`: 先端との間に仕切りがある。
 * - `visited`: 道がもう通ったマス。
 */
export type HamiltonianPathExtensionRejection =
  | "outside-board"
  | "not-adjacent"
  | "wall"
  | "partition"
  | "visited";

export type HamiltonianPathExtension =
  | { kind: "extended"; state: HamiltonianPathPuzzleState }
  | { kind: "rejected"; reason: HamiltonianPathExtensionRejection };

/**
 * 先端を隣のマスへ動かした結果。`retracted` は直前のマスへ戻って道が1マス縮んだこと。
 * `rejected` の理由は `HamiltonianPathExtension` と同じ。
 */
export type HamiltonianPathHeadMove =
  | { kind: "extended"; state: HamiltonianPathPuzzleState }
  | { kind: "retracted"; state: HamiltonianPathPuzzleState }
  | { kind: "rejected"; reason: HamiltonianPathExtensionRejection };

function findExtensionRejection(
  board: HamiltonianPathBoard,
  state: HamiltonianPathPuzzleState,
  cell: number,
): HamiltonianPathExtensionRejection | null {
  const head = getHamiltonianPathHead(state);
  if (!isHamiltonianPathCellOnBoard(board.size, cell)) {
    return "outside-board";
  }
  if (!areHamiltonianPathCellsAdjacent(board.size, head, cell)) {
    return "not-adjacent";
  }
  if (isHamiltonianPathWall(board, cell)) {
    return "wall";
  }
  if (hasHamiltonianPathPartition(board, head, cell)) {
    return "partition";
  }
  if (state.path.includes(cell)) {
    return "visited";
  }
  return null;
}

/** 先端から隣のマスへ道を1マス延ばす。 */
export function extendHamiltonianPath(
  board: HamiltonianPathBoard,
  state: HamiltonianPathPuzzleState,
  cell: number,
): HamiltonianPathExtension {
  const rejection = findExtensionRejection(board, state, cell);
  if (rejection !== null) {
    return { kind: "rejected", reason: rejection };
  }
  return { kind: "extended", state: { path: [...state.path, cell] } };
}

/** 先端を1マス戻す。道が始点だけなら同じ状態を返す。 */
export function retractHamiltonianPath(
  state: HamiltonianPathPuzzleState,
): HamiltonianPathPuzzleState {
  if (state.path.length <= 1) {
    return state;
  }
  return { path: state.path.slice(0, -1) };
}

/** 道の途中のマス（始点を含む）まで巻き戻し、そのマスを先端にする。道に無いマスや先端なら同じ状態を返す。 */
export function rewindHamiltonianPath(
  state: HamiltonianPathPuzzleState,
  cell: number,
): HamiltonianPathPuzzleState {
  const position = state.path.indexOf(cell);
  if (position < 0 || position === state.path.length - 1) {
    return state;
  }
  return { path: state.path.slice(0, position + 1) };
}

/**
 * 先端を隣のマスへ動かす。直前のマスへ動かすと道が1マス縮み、それ以外は道を延ばす。
 * ドラッグと矢印キーで道を引くときの1マスぶんの操作。道の途中のマスへの移動は巻き戻さない。
 */
export function moveHamiltonianPathHead(
  board: HamiltonianPathBoard,
  state: HamiltonianPathPuzzleState,
  cell: number,
): HamiltonianPathHeadMove {
  if (state.path.length >= 2 && state.path.at(-2) === cell) {
    return { kind: "retracted", state: retractHamiltonianPath(state) };
  }
  return extendHamiltonianPath(board, state, cell);
}
