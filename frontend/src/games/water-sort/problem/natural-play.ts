import {
  createWaterSortStateKey,
  isWaterSortCleared,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";
import {
  listWaterSortDistinctTransitions,
  type WaterSortTransition,
} from "@/games/water-sort/puzzle/transitions";

export type WaterSortNaturalPlayOptions = {
  trialCount?: number;
  random: () => number;
};

export type WaterSortNaturalPlayAnalysis = {
  trialCount: number;
  stuckTrialCount: number;
  stuckRate: number;
};

const defaultTrialCount = 30;
const maximumMovesPerTrial = 500;

function isSameColorPour(
  state: WaterSortState,
  transition: WaterSortTransition,
): boolean {
  const sourceColor = state[transition.move.sourceBottleIndex]?.at(-1);
  const destinationColor =
    state[transition.move.destinationBottleIndex]?.at(-1);

  return sourceColor !== undefined && sourceColor === destinationColor;
}

function listNaturalUnvisitedTransitions(
  state: WaterSortState,
  visitedStateKeys: ReadonlySet<string>,
): WaterSortTransition[] {
  const unvisited = listWaterSortDistinctTransitions(state).filter(
    ({ stateKey }) => !visitedStateKeys.has(stateKey),
  );
  const sameColor = unvisited.filter((transition) =>
    isSameColorPour(state, transition),
  );

  return sameColor.length > 0 ? sameColor : unvisited;
}

function playNaturally(
  initialState: WaterSortState,
  random: () => number,
): boolean {
  let state = initialState;
  const visitedStateKeys = new Set([createWaterSortStateKey(state)]);

  for (let moveCount = 0; !isWaterSortCleared(state); moveCount += 1) {
    if (moveCount >= maximumMovesPerTrial) {
      return false;
    }

    const candidates = listNaturalUnvisitedTransitions(state, visitedStateKeys);
    const next = candidates[Math.floor(random() * candidates.length)];
    if (!next) {
      return false;
    }

    state = next.state;
    visitedStateKeys.add(next.stateKey);
  }

  return true;
}

export function analyzeWaterSortNaturalPlay(
  initialState: WaterSortState,
  { trialCount = defaultTrialCount, random }: WaterSortNaturalPlayOptions,
): WaterSortNaturalPlayAnalysis {
  if (!Number.isInteger(trialCount) || trialCount < 1) {
    throw new RangeError("trialCount must be a positive integer");
  }

  let stuckTrialCount = 0;
  for (let trial = 0; trial < trialCount; trial += 1) {
    if (!playNaturally(initialState, random)) {
      stuckTrialCount += 1;
    }
  }

  return {
    trialCount,
    stuckTrialCount,
    stuckRate: stuckTrialCount / trialCount,
  };
}
