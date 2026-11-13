import type { HitofudePuzzleBoard } from "@/games/hitofude-puzzle/puzzle/board";

/** `path` は始点から先端までに通ったマスの番号で、先頭は常に始点。 */
export type HitofudePuzzlePuzzleState = {
  path: readonly number[];
};

export function createInitialHitofudePuzzleState(
  board: HitofudePuzzleBoard,
): HitofudePuzzlePuzzleState {
  return { path: [board.start] };
}

export function getHitofudePuzzleHead(
  state: HitofudePuzzlePuzzleState,
): number {
  return state.path.at(-1)!;
}
