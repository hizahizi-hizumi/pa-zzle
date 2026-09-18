import { getSudokuCandidates, isSudokuSolved } from "./rules";
import {
  assertSudokuBoard,
  getSudokuBlockIndex,
  getSudokuColumnIndex,
  getSudokuRowIndex,
  SUDOKU_CELL_COUNT,
  type SudokuBoard,
  type SudokuDigit,
} from "./state";

export type SudokuHumanTechnique = "naked-single" | "hidden-single";

export type SudokuUnit = {
  kind: "row" | "column" | "block";
  index: number;
};

export type SudokuCandidateChange = {
  cellIndex: number;
  before: readonly SudokuDigit[];
  after: readonly SudokuDigit[];
};

type SudokuHumanSolveStepBase = {
  order: number;
  cellIndex: number;
  digit: SudokuDigit;
  candidatesBefore: readonly SudokuDigit[];
  candidateChanges: readonly SudokuCandidateChange[];
};

export type SudokuHumanSolveStep =
  | (SudokuHumanSolveStepBase & {
      technique: "naked-single";
    })
  | (SudokuHumanSolveStepBase & {
      technique: "hidden-single";
      unit: SudokuUnit;
      unitCandidateCellIndices: readonly number[];
    });

export type SudokuHumanSolveFeatures = {
  stepCount: number;
  usedTechniques: readonly SudokuHumanTechnique[];
  techniqueCounts: Readonly<Record<SudokuHumanTechnique, number>>;
  solvedWithSupportedTechniques: boolean;
};

export type SudokuHumanSolveResult = {
  status: "solved" | "stalled";
  board: SudokuBoard;
  steps: readonly SudokuHumanSolveStep[];
  features: SudokuHumanSolveFeatures;
};

type CandidateState = readonly (readonly SudokuDigit[])[];

type Placement =
  | {
      technique: "naked-single";
      cellIndex: number;
      digit: SudokuDigit;
    }
  | {
      technique: "hidden-single";
      cellIndex: number;
      digit: SudokuDigit;
      unit: SudokuUnit;
      unitCandidateCellIndices: readonly number[];
    };

const UNIT_KINDS = ["row", "column", "block"] as const;

function getCandidateState(board: SudokuBoard): CandidateState {
  return Array.from({ length: SUDOKU_CELL_COUNT }, (_, cellIndex) =>
    getSudokuCandidates(board, cellIndex),
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

function getUnitIndex(kind: SudokuUnit["kind"], cellIndex: number): number {
  switch (kind) {
    case "row":
      return getSudokuRowIndex(cellIndex);
    case "column":
      return getSudokuColumnIndex(cellIndex);
    case "block":
      return getSudokuBlockIndex(cellIndex);
  }
}

function findHiddenSingle(candidates: CandidateState): Placement | null {
  for (let cellIndex = 0; cellIndex < candidates.length; cellIndex += 1) {
    const cellCandidates = candidates[cellIndex]!;

    for (const digit of cellCandidates) {
      for (const kind of UNIT_KINDS) {
        const unitIndex = getUnitIndex(kind, cellIndex);
        const unitCandidateCellIndices: number[] = [];

        for (
          let peerCellIndex = 0;
          peerCellIndex < candidates.length;
          peerCellIndex += 1
        ) {
          if (
            getUnitIndex(kind, peerCellIndex) === unitIndex &&
            candidates[peerCellIndex]!.includes(digit)
          ) {
            unitCandidateCellIndices.push(peerCellIndex);
          }
        }

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

function findNextPlacement(candidates: CandidateState): Placement | null {
  return findNakedSingle(candidates) ?? findHiddenSingle(candidates);
}

function candidateChanges(
  before: CandidateState,
  after: CandidateState,
): SudokuCandidateChange[] {
  const changes: SudokuCandidateChange[] = [];

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
): SudokuHumanSolveStep {
  const base = {
    order,
    cellIndex: placement.cellIndex,
    digit: placement.digit,
    candidatesBefore: candidatesBefore[placement.cellIndex]!,
    candidateChanges: candidateChanges(candidatesBefore, candidatesAfter),
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

function summarizeSteps(
  steps: readonly SudokuHumanSolveStep[],
  solvedWithSupportedTechniques: boolean,
): SudokuHumanSolveFeatures {
  const techniqueCounts: Record<SudokuHumanTechnique, number> = {
    "naked-single": 0,
    "hidden-single": 0,
  };
  const usedTechniques: SudokuHumanTechnique[] = [];

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
  };
}

export function traceSudokuHumanSolve(
  initialBoard: SudokuBoard,
): SudokuHumanSolveResult {
  assertSudokuBoard(initialBoard);

  const board = [...initialBoard];
  const steps: SudokuHumanSolveStep[] = [];

  while (!isSudokuSolved(board)) {
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
