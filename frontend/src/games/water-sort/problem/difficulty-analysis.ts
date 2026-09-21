import { applyWaterSortMove } from "../puzzle/rules";
import {
  countEmptyWaterSortBottles,
  countWaterSortColorBlocks,
  countWaterSortColors,
  createWaterSortStateKey,
  WATER_SORT_EMPTY_BOTTLE_COUNT,
  type WaterSortMove,
  type WaterSortState,
} from "../puzzle/state";
import {
  listWaterSortDistinctTransitions,
  type WaterSortTransition,
} from "../puzzle/transitions";
import { solveWaterSort } from "./generation/solver";

export type WaterSortRepresentativeChoiceRisk = {
  stateIndex: number;
  progressRatio: number;
  distinctChoiceCount: number;
  evaluatedChoiceCount: number;
  unresolvedChoiceCount: number;
  optimalChoiceRatio: number;
  detourChoiceRatio: number;
  deadEndChoiceRatio: number;
  maximumDetourMoves: number;
};

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
  shortestMoveCount: number;
  minimumMergeMoveCount: number;
  preparationMoveCount: number;
  preparationMoveRatio: number;
  averageEmptyBottlePressure: number;
  noEmptyBottleStateRatio: number;
  longestNoEmptyBottleRun: number;
  representativeChoiceRisk: WaterSortRepresentativeChoiceRisk;
  plausibleChoiceAnalysis: WaterSortPlausibleChoiceAnalysis;
};

export type WaterSortDifficultyAnalysisOptions = {
  maximumRiskChoices?: number;
  maxExpandedStatesPerRiskChoice?: number;
  maximumSampledDecisionStates?: number;
  maximumPlausibleChoicesPerState?: number;
  maxExpandedStatesPerPlausibleChoice?: number;
};

type RepresentativeChoiceState = {
  stateIndex: number;
  transitions: readonly WaterSortTransition[];
};

type DecisionState = {
  stateIndex: number;
  plausibleTransitions: readonly WaterSortTransition[];
};

const defaultMaximumRiskChoices = 8;
const defaultMaxExpandedStatesPerRiskChoice = 10_000;
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

function findRepresentativeChoiceState(
  solutionStates: readonly WaterSortState[],
): RepresentativeChoiceState {
  const shortestMoveCount = Math.max(0, solutionStates.length - 1);
  if (shortestMoveCount === 0) {
    return { stateIndex: 0, transitions: [] };
  }

  const firstCandidateIndex = Math.floor(shortestMoveCount * 0.2);
  const lastCandidateIndex = Math.min(
    shortestMoveCount - 1,
    Math.ceil(shortestMoveCount * 0.8),
  );
  let representative: RepresentativeChoiceState = {
    stateIndex: firstCandidateIndex,
    transitions: [
      ...listWaterSortDistinctTransitions(
        solutionStates[firstCandidateIndex] ?? solutionStates[0] ?? [],
      ),
    ].sort((left, right) => left.stateKey.localeCompare(right.stateKey)),
  };

  for (
    let stateIndex = firstCandidateIndex + 1;
    stateIndex <= lastCandidateIndex;
    stateIndex += 1
  ) {
    const state = solutionStates[stateIndex];
    if (!state) {
      continue;
    }
    const transitions = [...listWaterSortDistinctTransitions(state)].sort(
      (left, right) => left.stateKey.localeCompare(right.stateKey),
    );
    if (transitions.length > representative.transitions.length) {
      representative = { stateIndex, transitions };
    }
  }

  return representative;
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

function analyzeRepresentativeChoiceRisk(
  solutionStates: readonly WaterSortState[],
  maximumRiskChoices: number,
  maxExpandedStatesPerRiskChoice: number,
): WaterSortRepresentativeChoiceRisk {
  const shortestMoveCount = Math.max(0, solutionStates.length - 1);
  const representative = findRepresentativeChoiceState(solutionStates);
  const representativeState = solutionStates[representative.stateIndex];
  const nextSolutionState = solutionStates[representative.stateIndex + 1];
  if (!representativeState || representative.transitions.length === 0) {
    return {
      stateIndex: representative.stateIndex,
      progressRatio:
        shortestMoveCount === 0
          ? 0
          : representative.stateIndex / shortestMoveCount,
      distinctChoiceCount: 0,
      evaluatedChoiceCount: 0,
      unresolvedChoiceCount: 0,
      optimalChoiceRatio: 0,
      detourChoiceRatio: 0,
      deadEndChoiceRatio: 0,
      maximumDetourMoves: 0,
    };
  }

  const sampledTransitions = selectEvenlySpacedTransitions(
    representative.transitions,
    maximumRiskChoices,
    nextSolutionState ? createWaterSortStateKey(nextSolutionState) : undefined,
  );
  const remainingMoveCount = shortestMoveCount - representative.stateIndex;
  let optimalChoiceCount = 0;
  let detourChoiceCount = 0;
  let deadEndChoiceCount = 0;
  let unresolvedChoiceCount = 0;
  let maximumDetourMoves = 0;

  for (const transition of sampledTransitions) {
    const result = solveWaterSort(transition.state, {
      maxExpandedStates: maxExpandedStatesPerRiskChoice,
    });
    if (result.status === "limit-reached") {
      unresolvedChoiceCount += 1;
      continue;
    }
    if (result.status === "unsolvable") {
      deadEndChoiceCount += 1;
      continue;
    }

    const detourMoves = 1 + result.moves.length - remainingMoveCount;
    if (detourMoves < 0) {
      throw new Error("Choice analysis found a path shorter than the optimum");
    }
    if (detourMoves === 0) {
      optimalChoiceCount += 1;
    } else {
      detourChoiceCount += 1;
      maximumDetourMoves = Math.max(maximumDetourMoves, detourMoves);
    }
  }

  const evaluatedChoiceCount =
    sampledTransitions.length - unresolvedChoiceCount;

  return {
    stateIndex: representative.stateIndex,
    progressRatio:
      shortestMoveCount === 0
        ? 0
        : representative.stateIndex / shortestMoveCount,
    distinctChoiceCount: representative.transitions.length,
    evaluatedChoiceCount,
    unresolvedChoiceCount,
    optimalChoiceRatio:
      evaluatedChoiceCount === 0
        ? 0
        : optimalChoiceCount / evaluatedChoiceCount,
    detourChoiceRatio:
      evaluatedChoiceCount === 0 ? 0 : detourChoiceCount / evaluatedChoiceCount,
    deadEndChoiceRatio:
      evaluatedChoiceCount === 0
        ? 0
        : deadEndChoiceCount / evaluatedChoiceCount,
    maximumDetourMoves,
  };
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
    const middleIndex = Math.floor(decisionStates.length / 2);
    const middle = decisionStates[middleIndex];
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
  const decisionStates = findDecisionStates(solutionStates);
  const sampledDecisionStates = selectEvenlySpacedDecisionStates(
    decisionStates,
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
  const maximumRiskChoices =
    options.maximumRiskChoices ?? defaultMaximumRiskChoices;
  const maxExpandedStatesPerRiskChoice =
    options.maxExpandedStatesPerRiskChoice ??
    defaultMaxExpandedStatesPerRiskChoice;
  const maximumSampledDecisionStates =
    options.maximumSampledDecisionStates ?? defaultMaximumSampledDecisionStates;
  const maximumPlausibleChoicesPerState =
    options.maximumPlausibleChoicesPerState ??
    defaultMaximumPlausibleChoicesPerState;
  const maxExpandedStatesPerPlausibleChoice =
    options.maxExpandedStatesPerPlausibleChoice ??
    defaultMaxExpandedStatesPerPlausibleChoice;

  validatePositiveInteger(maximumRiskChoices, "maximumRiskChoices");
  validateNonNegativeInteger(
    maxExpandedStatesPerRiskChoice,
    "maxExpandedStatesPerRiskChoice",
  );
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
  const playableStates = solutionStates.slice(0, -1);
  const shortestMoveCount = solutionMoves.length;
  const minimumMergeMoveCount = Math.max(
    0,
    countWaterSortColorBlocks(initialState) -
      countWaterSortColors(initialState),
  );
  const preparationMoveCount = Math.max(
    0,
    shortestMoveCount - minimumMergeMoveCount,
  );
  const emptyBottlePressures = playableStates.map((state) =>
    Math.max(
      0,
      Math.min(
        1,
        1 - countEmptyWaterSortBottles(state) / WATER_SORT_EMPTY_BOTTLE_COUNT,
      ),
    ),
  );
  const noEmptyBottleFlags = playableStates.map(
    (state) => countEmptyWaterSortBottles(state) === 0,
  );

  let longestNoEmptyBottleRun = 0;
  let currentNoEmptyBottleRun = 0;
  for (const hasNoEmptyBottle of noEmptyBottleFlags) {
    if (hasNoEmptyBottle) {
      currentNoEmptyBottleRun += 1;
      longestNoEmptyBottleRun = Math.max(
        longestNoEmptyBottleRun,
        currentNoEmptyBottleRun,
      );
    } else {
      currentNoEmptyBottleRun = 0;
    }
  }

  const averageEmptyBottlePressure =
    emptyBottlePressures.length === 0
      ? 0
      : emptyBottlePressures.reduce((sum, pressure) => sum + pressure, 0) /
        emptyBottlePressures.length;
  const noEmptyBottleStateCount = noEmptyBottleFlags.filter(Boolean).length;

  return {
    shortestMoveCount,
    minimumMergeMoveCount,
    preparationMoveCount,
    preparationMoveRatio:
      shortestMoveCount === 0 ? 0 : preparationMoveCount / shortestMoveCount,
    averageEmptyBottlePressure,
    noEmptyBottleStateRatio:
      playableStates.length === 0
        ? 0
        : noEmptyBottleStateCount / playableStates.length,
    longestNoEmptyBottleRun,
    representativeChoiceRisk: analyzeRepresentativeChoiceRisk(
      solutionStates,
      maximumRiskChoices,
      maxExpandedStatesPerRiskChoice,
    ),
    plausibleChoiceAnalysis: analyzePlausibleChoices(
      solutionStates,
      maximumSampledDecisionStates,
      maximumPlausibleChoicesPerState,
      maxExpandedStatesPerPlausibleChoice,
    ),
  };
}
