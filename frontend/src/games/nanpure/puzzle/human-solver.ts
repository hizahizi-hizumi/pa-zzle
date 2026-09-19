import {
  assertNanpureBoard,
  getNanpureBlockIndex,
  getNanpureColumnIndex,
  getNanpureRowIndex,
  NANPURE_CELL_COUNT,
  type NanpureBoard,
  type NanpureDigit,
} from "./board";
import { getNanpureCandidates, isNanpureSolved } from "./rules";

export type NanpureHumanTechnique = "naked-single" | "hidden-single";

export type NanpureUnit = {
  kind: "row" | "column" | "block";
  index: number;
};

export type NanpureCandidateChange = {
  cellIndex: number;
  before: readonly NanpureDigit[];
  after: readonly NanpureDigit[];
};

type NanpureHumanSolveStepBase = {
  order: number;
  cellIndex: number;
  digit: NanpureDigit;
  candidatesBefore: readonly NanpureDigit[];
  candidateChanges: readonly NanpureCandidateChange[];
  availablePlacementCount: number;
};

export type NanpureHumanSolveStep =
  | (NanpureHumanSolveStepBase & {
      technique: "naked-single";
    })
  | (NanpureHumanSolveStepBase & {
      technique: "hidden-single";
      unit: NanpureUnit;
      unitCandidateCellIndices: readonly number[];
    });

export type NanpureDependencyFeatures = {
  observedStepCount: number;
  meanAvailablePlacementCount: number;
  minimumAvailablePlacementCount: number;
  singleOptionStepCount: number;
};

export type NanpureHumanSolveFeatures = {
  stepCount: number;
  usedTechniques: readonly NanpureHumanTechnique[];
  techniqueCounts: Readonly<Record<NanpureHumanTechnique, number>>;
  solvedWithSupportedTechniques: boolean;
  dependency: NanpureDependencyFeatures;
};

export type NanpureHumanSolveResult = {
  status: "solved" | "stalled";
  board: NanpureBoard;
  steps: readonly NanpureHumanSolveStep[];
  features: NanpureHumanSolveFeatures;
};

type CandidateState = readonly (readonly NanpureDigit[])[];

type Placement =
  | {
      technique: "naked-single";
      cellIndex: number;
      digit: NanpureDigit;
    }
  | {
      technique: "hidden-single";
      cellIndex: number;
      digit: NanpureDigit;
      unit: NanpureUnit;
      unitCandidateCellIndices: readonly number[];
    };

const UNIT_KINDS = ["row", "column", "block"] as const;
export const NANPURE_DEPENDENCY_WINDOW_STEP_COUNT = 25;

function getCandidateState(board: NanpureBoard): CandidateState {
  return Array.from({ length: NANPURE_CELL_COUNT }, (_, cellIndex) =>
    getNanpureCandidates(board, cellIndex),
  );
}

function findNakedSingle(candidates: CandidateState): Placement | null {
  for (let cellIndex = 0; cellIndex < candidates.length; cellIndex += 1) {
    const cellCandidates = candidates[cellIndex]!;
    if (cellCandidates.length === 1) {
      return {
        technique: "naked-single",
        cellIndex,
        digit: cellCandidates[0]!,
      };
    }
  }

  return null;
}

function getUnitIndex(kind: NanpureUnit["kind"], cellIndex: number): number {
  switch (kind) {
    case "row":
      return getNanpureRowIndex(cellIndex);
    case "column":
      return getNanpureColumnIndex(cellIndex);
    case "block":
      return getNanpureBlockIndex(cellIndex);
  }
}

function getUnitCandidateCellIndices(
  candidates: CandidateState,
  kind: NanpureUnit["kind"],
  unitIndex: number,
  digit: NanpureDigit,
): number[] {
  const cellIndices: number[] = [];

  for (let cellIndex = 0; cellIndex < candidates.length; cellIndex += 1) {
    if (
      getUnitIndex(kind, cellIndex) === unitIndex &&
      candidates[cellIndex]!.includes(digit)
    ) {
      cellIndices.push(cellIndex);
    }
  }

  return cellIndices;
}

function findHiddenSingle(candidates: CandidateState): Placement | null {
  for (let cellIndex = 0; cellIndex < candidates.length; cellIndex += 1) {
    const cellCandidates = candidates[cellIndex]!;

    for (const digit of cellCandidates) {
      for (const kind of UNIT_KINDS) {
        const unitIndex = getUnitIndex(kind, cellIndex);
        const unitCandidateCellIndices = getUnitCandidateCellIndices(
          candidates,
          kind,
          unitIndex,
          digit,
        );

        if (unitCandidateCellIndices.length === 1) {
          return {
            technique: "hidden-single",
            cellIndex,
            digit,
            unit: { kind, index: unitIndex },
            unitCandidateCellIndices,
          };
        }
      }
    }
  }

  return null;
}

function countAvailablePlacements(candidates: CandidateState): number {
  const placements = new Set<string>();

  for (let cellIndex = 0; cellIndex < candidates.length; cellIndex += 1) {
    const cellCandidates = candidates[cellIndex]!;
    if (cellCandidates.length === 1) {
      placements.add(`${cellIndex}:${cellCandidates[0]}`);
    }

    for (const digit of cellCandidates) {
      for (const kind of UNIT_KINDS) {
        const unitIndex = getUnitIndex(kind, cellIndex);
        const unitCandidateCellIndices = getUnitCandidateCellIndices(
          candidates,
          kind,
          unitIndex,
          digit,
        );
        if (unitCandidateCellIndices.length === 1) {
          placements.add(`${cellIndex}:${digit}`);
        }
      }
    }
  }

  return placements.size;
}

function findNextPlacement(candidates: CandidateState): Placement | null {
  return findNakedSingle(candidates) ?? findHiddenSingle(candidates);
}

function candidateChanges(
  before: CandidateState,
  after: CandidateState,
): NanpureCandidateChange[] {
  const changes: NanpureCandidateChange[] = [];

  for (let cellIndex = 0; cellIndex < before.length; cellIndex += 1) {
    const previous = before[cellIndex]!;
    const next = after[cellIndex]!;

    if (
      previous.length === next.length &&
      previous.every((digit, index) => digit === next[index])
    ) {
      continue;
    }

    changes.push({ cellIndex, before: previous, after: next });
  }

  return changes;
}

function createStep(
  placement: Placement,
  order: number,
  candidatesBefore: CandidateState,
  candidatesAfter: CandidateState,
): NanpureHumanSolveStep {
  const base = {
    order,
    cellIndex: placement.cellIndex,
    digit: placement.digit,
    candidatesBefore: candidatesBefore[placement.cellIndex]!,
    candidateChanges: candidateChanges(candidatesBefore, candidatesAfter),
    availablePlacementCount: countAvailablePlacements(candidatesBefore),
  };

  if (placement.technique === "naked-single") {
    return { ...base, technique: placement.technique };
  }

  return {
    ...base,
    technique: placement.technique,
    unit: placement.unit,
    unitCandidateCellIndices: placement.unitCandidateCellIndices,
  };
}

function summarizeDependency(
  steps: readonly NanpureHumanSolveStep[],
): NanpureDependencyFeatures {
  const observedSteps = steps.slice(0, NANPURE_DEPENDENCY_WINDOW_STEP_COUNT);
  if (observedSteps.length === 0) {
    return {
      observedStepCount: 0,
      meanAvailablePlacementCount: 0,
      minimumAvailablePlacementCount: 0,
      singleOptionStepCount: 0,
    };
  }

  const counts = observedSteps.map((step) => step.availablePlacementCount);
  const total = counts.reduce((sum, count) => sum + count, 0);

  return {
    observedStepCount: observedSteps.length,
    meanAvailablePlacementCount: total / observedSteps.length,
    minimumAvailablePlacementCount: Math.min(...counts),
    singleOptionStepCount: counts.filter((count) => count === 1).length,
  };
}

function summarizeSteps(
  steps: readonly NanpureHumanSolveStep[],
  solvedWithSupportedTechniques: boolean,
): NanpureHumanSolveFeatures {
  const techniqueCounts: Record<NanpureHumanTechnique, number> = {
    "naked-single": 0,
    "hidden-single": 0,
  };
  const usedTechniques: NanpureHumanTechnique[] = [];

  for (const step of steps) {
    if (techniqueCounts[step.technique] === 0) {
      usedTechniques.push(step.technique);
    }
    techniqueCounts[step.technique] += 1;
  }

  return {
    stepCount: steps.length,
    usedTechniques,
    techniqueCounts,
    solvedWithSupportedTechniques,
    dependency: summarizeDependency(steps),
  };
}

export function traceNanpureHumanSolve(
  initialBoard: NanpureBoard,
): NanpureHumanSolveResult {
  assertNanpureBoard(initialBoard);

  const board = [...initialBoard];
  const steps: NanpureHumanSolveStep[] = [];

  while (!isNanpureSolved(board)) {
    const candidatesBefore = getCandidateState(board);
    const placement = findNextPlacement(candidatesBefore);
    if (!placement) {
      const features = summarizeSteps(steps, false);
      return { status: "stalled", board, steps, features };
    }

    board[placement.cellIndex] = placement.digit;
    const candidatesAfter = getCandidateState(board);
    steps.push(
      createStep(
        placement,
        steps.length + 1,
        candidatesBefore,
        candidatesAfter,
      ),
    );
  }

  const features = summarizeSteps(steps, true);
  return { status: "solved", board, steps, features };
}
