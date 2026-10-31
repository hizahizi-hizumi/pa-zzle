import type { HamiltonianPathBoard } from "@/games/hamiltonian-path/puzzle/board";

/** 引いている道。`path` は始点から先端までに通ったマスの番号で、先頭は常に始点。 */
export type HamiltonianPathPuzzleState = {
  path: readonly number[];
};

/** 道が始点だけの状態。 */
export function createInitialHamiltonianPathState(
  board: HamiltonianPathBoard,
): HamiltonianPathPuzzleState {
  return { path: [board.start] };
}

/** 道の先端のマス。 */
export function getHamiltonianPathHead(
  state: HamiltonianPathPuzzleState,
): number {
  return state.path.at(-1)!;
}
