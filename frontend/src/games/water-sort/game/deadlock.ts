import {
  createWaterSortStateKey,
  isWaterSortCleared,
  type WaterSortState,
} from "./state";
import { listWaterSortDistinctTransitions } from "./transitions";

export type WaterSortDeadlockStatus = "playable" | "deadlocked" | "unknown";

export type WaterSortDeadlockOptions = {
  maxVisitedStates?: number;
};

const DEFAULT_MAX_VISITED_STATES = 1_000;

export function classifyWaterSortDeadlock(
  initialState: WaterSortState,
  options: WaterSortDeadlockOptions = {},
): WaterSortDeadlockStatus {
  const maxVisitedStates =
    options.maxVisitedStates ?? DEFAULT_MAX_VISITED_STATES;
  if (
    maxVisitedStates !== Number.POSITIVE_INFINITY &&
    (!Number.isInteger(maxVisitedStates) || maxVisitedStates < 1)
  ) {
    throw new RangeError(
      "maxVisitedStates must be a positive integer or Infinity",
    );
  }

  if (isWaterSortCleared(initialState)) {
    return "playable";
  }

  const initialStateKey = createWaterSortStateKey(initialState);
  const indexByState = new Map<string, number>();
  const lowLinkByState = new Map<string, number>();
  const stack: string[] = [];
  const statesOnStack = new Set<string>();
  let nextIndex = 0;
  let resolvedStatus: WaterSortDeadlockStatus | null = null;

  const visit = (state: WaterSortState, stateKey: string): void => {
    const index = nextIndex;
    nextIndex += 1;
    indexByState.set(stateKey, index);
    lowLinkByState.set(stateKey, index);
    stack.push(stateKey);
    statesOnStack.add(stateKey);

    if (isWaterSortCleared(state)) {
      resolvedStatus = "playable";
      return;
    }

    for (const transition of listWaterSortDistinctTransitions(state)) {
      if (resolvedStatus) {
        return;
      }

      const knownIndex = indexByState.get(transition.stateKey);
      if (knownIndex === undefined) {
        if (indexByState.size >= maxVisitedStates) {
          resolvedStatus = "unknown";
          return;
        }

        visit(transition.state, transition.stateKey);
        if (resolvedStatus) {
          return;
        }

        const childLowLink = lowLinkByState.get(transition.stateKey);
        const currentLowLink = lowLinkByState.get(stateKey);
        if (childLowLink === undefined || currentLowLink === undefined) {
          throw new Error("Water Sort deadlock traversal lost a visited state");
        }
        lowLinkByState.set(stateKey, Math.min(currentLowLink, childLowLink));
        continue;
      }

      if (!statesOnStack.has(transition.stateKey)) {
        continue;
      }

      const currentLowLink = lowLinkByState.get(stateKey);
      if (currentLowLink === undefined) {
        throw new Error("Water Sort deadlock traversal lost the current state");
      }
      lowLinkByState.set(stateKey, Math.min(currentLowLink, knownIndex));
    }

    const lowLink = lowLinkByState.get(stateKey);
    if (lowLink !== index) {
      return;
    }

    while (true) {
      const poppedStateKey = stack.pop();
      if (poppedStateKey === undefined) {
        throw new Error("Water Sort deadlock traversal stack became empty");
      }
      statesOnStack.delete(poppedStateKey);
      if (poppedStateKey === stateKey) {
        break;
      }
    }

    if (stateKey !== initialStateKey) {
      // A separately completed SCC is reachable from, but cannot return to, the initial SCC.
      resolvedStatus = "playable";
    }
  };

  visit(initialState, initialStateKey);
  return resolvedStatus ?? "deadlocked";
}
