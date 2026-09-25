import {
  applyWaterSortMove,
  listWaterSortLegalMoves,
} from "@/games/water-sort/puzzle/rules";
import {
  createWaterSortStateKey,
  type WaterSortMove,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";

export type WaterSortTransition = {
  state: WaterSortState;
  stateKey: string;
  move: WaterSortMove;
};

export function listWaterSortDistinctTransitions(
  state: WaterSortState,
): WaterSortTransition[] {
  const currentStateKey = createWaterSortStateKey(state);
  const seenStateKeys = new Set<string>();
  const transitions: WaterSortTransition[] = [];

  for (const move of listWaterSortLegalMoves(state)) {
    const nextState = applyWaterSortMove(state, move);
    if (!nextState) {
      continue;
    }

    const stateKey = createWaterSortStateKey(nextState);
    if (stateKey === currentStateKey || seenStateKeys.has(stateKey)) {
      continue;
    }

    seenStateKeys.add(stateKey);
    transitions.push({ state: nextState, stateKey, move });
  }

  return transitions;
}
