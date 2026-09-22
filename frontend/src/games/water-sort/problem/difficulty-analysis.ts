import { solveWaterSort } from "@/games/water-sort/problem/generation/solver";
import { applyWaterSortMove } from "@/games/water-sort/puzzle/rules";
import {
  createWaterSortStateKey,
  type WaterSortMove,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";
import {
  listWaterSortDistinctTransitions,
  type WaterSortTransition,
} from "@/games/water-sort/puzzle/transitions";

export type WaterSortPlausibleChoiceAnalysis = {
  sampledDecisionStateCount: number;
  singleChoiceDecisionStateCount: number;
  ambiguousDecisionStateCount: number;
  evaluatedChoiceCount: number;
  unresolvedChoiceCount: number;
  optimalChoiceCount: number;
  detourChoiceCount: number;
  deadEndChoiceCount: number;
  detourDecisionStateCount: number;
  deadEndDecisionStateCount: number;
  ambiguousDecisionStateRatio: number;
  detourDecisionStateRatio: number;
  deadEndDecisionStateRatio: number;
  detourChoiceRatio: number;
  deadEndChoiceRatio: number;
  maximumDetourMoves: number;
  minimumSolvableChoiceRatio: number;
};

export type WaterSortDifficultyAnalysis = {
  plausibleChoiceAnalysis: WaterSortPlausibleChoiceAnalysis;
};

export type WaterSortDifficultyAnalysisOptions = {
  maximumSampledDecisionStates?: number;
  maximumPlausibleChoicesPerState?: number;
  maxExpandedStatesPerPlausibleChoice?: number;
};

type DecisionState = {
  stateIndex: number;
  plausibleTransitions: readonly WaterSortTransition[];
};

const defaultMaximumSampledDecisionStates = 5;
const defaultMaximumPlausibleChoicesPerState = 8;
const defaultMaxExpandedStatesPerPlausibleChoice = 10_000;

function buildSolutionStates(
  initialState: WaterSortState,
  solutionMoves: readonly WaterSortMove[],
): WaterSortState[] {
  const states: WaterSortState[] = [initialState];
  let state = initialState;

  for (const move of solutionMoves) {
    const nextState = applyWaterSortMove(state, move);
    if (!nextState) {
      throw new Error("Solution path contains an invalid water sort move");
    }
    states.push(nextState);
    state = nextState;
  }

  return states;
}

function selectEvenlySpacedTransitions(
  transitions: readonly WaterSortTransition[],
  maximumCount: number,
  preferredStateKey: string | undefined,
): WaterSortTransition[] {
  if (transitions.length <= maximumCount) {
    return [...transitions];
  }

  const preferred = preferredStateKey
    ? transitions.find(({ stateKey }) => stateKey === preferredStateKey)
    : undefined;
  const candidates = preferred
    ? transitions.filter(({ stateKey }) => stateKey !== preferred.stateKey)
    : [...transitions];
  const sampledCount = maximumCount - (preferred ? 1 : 0);
  const sampled = Array.from({ length: sampledCount }, (_, index) => {
    const candidateIndex = Math.floor(
      (index * candidates.length) / sampledCount,
    );
    return candidates[candidateIndex];
  }).filter(
    (transition): transition is WaterSortTransition => transition !== undefined,
  );

  return preferred ? [preferred, ...sampled] : sampled;
}

function isSameColorPour(
  state: WaterSortState,
  transition: WaterSortTransition,
): boolean {
  const source = state[transition.move.sourceBottleIndex];
  const destination = state[transition.move.destinationBottleIndex];
  const sourceColor = source?.at(-1);
  const destinationColor = destination?.at(-1);

  return (
    sourceColor !== undefined &&
    destinationColor !== undefined &&
    sourceColor === destinationColor
  );
}

function findDecisionStates(
  solutionStates: readonly WaterSortState[],
): DecisionState[] {
  const decisionStates: DecisionState[] = [];

  for (
    let stateIndex = 0;
    stateIndex < solutionStates.length - 1;
    stateIndex += 1
  ) {
    const state = solutionStates[stateIndex];
    if (!state) {
      continue;
    }

    const transitions = [...listWaterSortDistinctTransitions(state)].sort(
      (left, right) => left.stateKey.localeCompare(right.stateKey),
    );
    if (transitions.length < 2) {
      continue;
    }

    const sameColorTransitions = transitions.filter((transition) =>
      isSameColorPour(state, transition),
    );
    decisionStates.push({
      stateIndex,
      plausibleTransitions:
        sameColorTransitions.length > 0 ? sameColorTransitions : transitions,
    });
  }

  return decisionStates;
}

function selectEvenlySpacedDecisionStates(
  decisionStates: readonly DecisionState[],
  maximumCount: number,
): DecisionState[] {
  if (decisionStates.length <= maximumCount) {
    return [...decisionStates];
  }
  if (maximumCount === 1) {
    const middle = decisionStates[Math.floor(decisionStates.length / 2)];
    return middle ? [middle] : [];
  }

  const selected: DecisionState[] = [];
  const selectedIndexes = new Set<number>();

  for (let index = 0; index < maximumCount; index += 1) {
    const decisionStateIndex = Math.round(
      (index * (decisionStates.length - 1)) / (maximumCount - 1),
    );
    if (selectedIndexes.has(decisionStateIndex)) {
      continue;
    }

    const decisionState = decisionStates[decisionStateIndex];
    if (!decisionState) {
      continue;
    }
    selectedIndexes.add(decisionStateIndex);
    selected.push(decisionState);
  }

  return selected;
}

function analyzePlausibleChoices(
  solutionStates: readonly WaterSortState[],
  maximumSampledDecisionStates: number,
  maximumPlausibleChoicesPerState: number,
  maxExpandedStatesPerPlausibleChoice: number,
): WaterSortPlausibleChoiceAnalysis {
  const shortestMoveCount = Math.max(0, solutionStates.length - 1);
  const sampledDecisionStates = selectEvenlySpacedDecisionStates(
    findDecisionStates(solutionStates),
    maximumSampledDecisionStates,
  );

  let singleChoiceDecisionStateCount = 0;
  let ambiguousDecisionStateCount = 0;
  let evaluatedChoiceCount = 0;
  let unresolvedChoiceCount = 0;
  let optimalChoiceCount = 0;
  let detourChoiceCount = 0;
  let deadEndChoiceCount = 0;
  let detourDecisionStateCount = 0;
  let deadEndDecisionStateCount = 0;
  let maximumDetourMoves = 0;
  let minimumSolvableChoiceRatio = 1;

  for (const decisionState of sampledDecisionStates) {
    if (decisionState.plausibleTransitions.length === 1) {
      singleChoiceDecisionStateCount += 1;
    } else {
      ambiguousDecisionStateCount += 1;
    }

    const nextSolutionState = solutionStates[decisionState.stateIndex + 1];
    const sampledTransitions = selectEvenlySpacedTransitions(
      decisionState.plausibleTransitions,
      maximumPlausibleChoicesPerState,
      nextSolutionState
        ? createWaterSortStateKey(nextSolutionState)
        : undefined,
    );
    const remainingMoveCount = shortestMoveCount - decisionState.stateIndex;
    let stateEvaluatedChoiceCount = 0;
    let stateDetourChoiceCount = 0;
    let stateDeadEndChoiceCount = 0;

    for (const transition of sampledTransitions) {
      const result = solveWaterSort(transition.state, {
        maxExpandedStates: maxExpandedStatesPerPlausibleChoice,
      });
      if (result.status === "limit-reached") {
        unresolvedChoiceCount += 1;
        continue;
      }

      evaluatedChoiceCount += 1;
      stateEvaluatedChoiceCount += 1;
      if (result.status === "unsolvable") {
        deadEndChoiceCount += 1;
        stateDeadEndChoiceCount += 1;
        continue;
      }

      const detourMoves = 1 + result.moves.length - remainingMoveCount;
      if (detourMoves < 0) {
        throw new Error("Plausible choice analysis found a shorter path");
      }
      if (detourMoves === 0) {
        optimalChoiceCount += 1;
      } else {
        detourChoiceCount += 1;
        stateDetourChoiceCount += 1;
        maximumDetourMoves = Math.max(maximumDetourMoves, detourMoves);
      }
    }

    if (stateDetourChoiceCount > 0) {
      detourDecisionStateCount += 1;
    }
    if (stateDeadEndChoiceCount > 0) {
      deadEndDecisionStateCount += 1;
    }
    if (stateEvaluatedChoiceCount > 0) {
      const solvableChoiceRatio =
        (stateEvaluatedChoiceCount - stateDeadEndChoiceCount) /
        stateEvaluatedChoiceCount;
      minimumSolvableChoiceRatio = Math.min(
        minimumSolvableChoiceRatio,
        solvableChoiceRatio,
      );
    }
  }

  return {
    sampledDecisionStateCount: sampledDecisionStates.length,
    singleChoiceDecisionStateCount,
    ambiguousDecisionStateCount,
    evaluatedChoiceCount,
    unresolvedChoiceCount,
    optimalChoiceCount,
    detourChoiceCount,
    deadEndChoiceCount,
    detourDecisionStateCount,
    deadEndDecisionStateCount,
    ambiguousDecisionStateRatio:
      sampledDecisionStates.length === 0
        ? 0
        : ambiguousDecisionStateCount / sampledDecisionStates.length,
    detourDecisionStateRatio:
      sampledDecisionStates.length === 0
        ? 0
        : detourDecisionStateCount / sampledDecisionStates.length,
    deadEndDecisionStateRatio:
      sampledDecisionStates.length === 0
        ? 0
        : deadEndDecisionStateCount / sampledDecisionStates.length,
    detourChoiceRatio:
      evaluatedChoiceCount === 0 ? 0 : detourChoiceCount / evaluatedChoiceCount,
    deadEndChoiceRatio:
      evaluatedChoiceCount === 0
        ? 0
        : deadEndChoiceCount / evaluatedChoiceCount,
    maximumDetourMoves,
    minimumSolvableChoiceRatio:
      evaluatedChoiceCount === 0 ? 1 : minimumSolvableChoiceRatio,
  };
}

function validatePositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function validateNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

export function analyzeWaterSortDifficulty(
  initialState: WaterSortState,
  solutionMoves: readonly WaterSortMove[],
  options: WaterSortDifficultyAnalysisOptions = {},
): WaterSortDifficultyAnalysis {
  const maximumSampledDecisionStates =
    options.maximumSampledDecisionStates ?? defaultMaximumSampledDecisionStates;
  const maximumPlausibleChoicesPerState =
    options.maximumPlausibleChoicesPerState ??
    defaultMaximumPlausibleChoicesPerState;
  const maxExpandedStatesPerPlausibleChoice =
    options.maxExpandedStatesPerPlausibleChoice ??
    defaultMaxExpandedStatesPerPlausibleChoice;

  validatePositiveInteger(
    maximumSampledDecisionStates,
    "maximumSampledDecisionStates",
  );
  validatePositiveInteger(
    maximumPlausibleChoicesPerState,
    "maximumPlausibleChoicesPerState",
  );
  validateNonNegativeInteger(
    maxExpandedStatesPerPlausibleChoice,
    "maxExpandedStatesPerPlausibleChoice",
  );

  const solutionStates = buildSolutionStates(initialState, solutionMoves);

  return {
    plausibleChoiceAnalysis: analyzePlausibleChoices(
      solutionStates,
      maximumSampledDecisionStates,
      maximumPlausibleChoicesPerState,
      maxExpandedStatesPerPlausibleChoice,
    ),
  };
}
