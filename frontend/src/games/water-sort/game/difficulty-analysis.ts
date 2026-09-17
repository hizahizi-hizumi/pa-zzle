import { applyWaterSortMove, listWaterSortLegalMoves } from "./rules";
import { solveWaterSort } from "./solver";
import {
  countEmptyWaterSortBottles,
  countWaterSortColorBlocks,
  countWaterSortColors,
  createWaterSortStateKey,
  WATER_SORT_EMPTY_BOTTLE_COUNT,
  type WaterSortMove,
  type WaterSortState,
} from "./state";

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

export type WaterSortDifficultyAnalysis = {
  shortestMoveCount: number;
  minimumMergeMoveCount: number;
  preparationMoveCount: number;
  preparationMoveRatio: number;
  averageEmptyBottlePressure: number;
  noEmptyBottleStateRatio: number;
  longestNoEmptyBottleRun: number;
  representativeChoiceRisk: WaterSortRepresentativeChoiceRisk;
};

export type WaterSortDifficultyAnalysisOptions = {
  maximumRiskChoices?: number;
  maxExpandedStatesPerRiskChoice?: number;
};

type DistinctTransition = {
  state: WaterSortState;
  stateKey: string;
};

type RepresentativeChoiceState = {
  stateIndex: number;
  transitions: readonly DistinctTransition[];
};

const defaultMaximumRiskChoices = 8;
const defaultMaxExpandedStatesPerRiskChoice = 10_000;

function listDistinctTransitions(state: WaterSortState): DistinctTransition[] {
  const currentStateKey = createWaterSortStateKey(state);
  const transitionsByStateKey = new Map<string, DistinctTransition>();

  for (const move of listWaterSortLegalMoves(state)) {
    const nextState = applyWaterSortMove(state, move);
    if (!nextState) {
      continue;
    }

    const stateKey = createWaterSortStateKey(nextState);
    if (stateKey === currentStateKey || transitionsByStateKey.has(stateKey)) {
      continue;
    }

    transitionsByStateKey.set(stateKey, { state: nextState, stateKey });
  }

  return [...transitionsByStateKey.values()].sort((left, right) =>
    left.stateKey.localeCompare(right.stateKey),
  );
}

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
    transitions: listDistinctTransitions(
      solutionStates[firstCandidateIndex] ?? solutionStates[0] ?? [],
    ),
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
    const transitions = listDistinctTransitions(state);
    if (transitions.length > representative.transitions.length) {
      representative = { stateIndex, transitions };
    }
  }

  return representative;
}

function selectEvenlySpacedTransitions(
  transitions: readonly DistinctTransition[],
  maximumCount: number,
  preferredStateKey: string | undefined,
): DistinctTransition[] {
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
    (transition): transition is DistinctTransition => transition !== undefined,
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

  if (!Number.isInteger(maximumRiskChoices) || maximumRiskChoices < 1) {
    throw new RangeError("maximumRiskChoices must be a positive integer");
  }
  if (
    !Number.isInteger(maxExpandedStatesPerRiskChoice) ||
    maxExpandedStatesPerRiskChoice < 0
  ) {
    throw new RangeError(
      "maxExpandedStatesPerRiskChoice must be a non-negative integer",
    );
  }

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
  };
}
