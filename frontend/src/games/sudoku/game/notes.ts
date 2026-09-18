import {
  areSudokuCellsRelated,
  assertSudokuCellIndex,
  SUDOKU_CELL_COUNT,
  type SudokuDigit,
} from "./state";

export type SudokuNotes = readonly (readonly SudokuDigit[])[];

export function createEmptySudokuNotes(): SudokuNotes {
  return Array.from({ length: SUDOKU_CELL_COUNT }, () => []);
}

export function clearSudokuCellNotes(
  notes: SudokuNotes,
  cellIndex: number,
): SudokuNotes {
  assertSudokuCellIndex(cellIndex);
  const cellNotes = notes[cellIndex] ?? [];
  if (cellNotes.length === 0) {
    return notes;
  }

  return notes.map((notesAtCell, index) =>
    index === cellIndex ? [] : notesAtCell,
  );
}

export function toggleSudokuNoteDigit(
  notes: SudokuNotes,
  cellIndex: number,
  digit: SudokuDigit,
): SudokuNotes {
  assertSudokuCellIndex(cellIndex);
  const currentNotes = notes[cellIndex] ?? [];
  const nextCellNotes = currentNotes.includes(digit)
    ? currentNotes.filter((note) => note !== digit)
    : [...currentNotes, digit].sort((left, right) => left - right);

  return notes.map((cellNotes, index) =>
    index === cellIndex ? nextCellNotes : cellNotes,
  );
}

export function clearSudokuNotesForCorrectEntry(
  notes: SudokuNotes,
  cellIndex: number,
  digit: SudokuDigit,
): SudokuNotes {
  assertSudokuCellIndex(cellIndex);

  return notes.map((cellNotes, index) => {
    if (index === cellIndex) {
      return cellNotes.length > 0 ? [] : cellNotes;
    }

    if (
      !areSudokuCellsRelated(cellIndex, index) ||
      !cellNotes.includes(digit)
    ) {
      return cellNotes;
    }

    return cellNotes.filter((note) => note !== digit);
  });
}
