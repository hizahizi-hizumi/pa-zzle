import {
  areNanpureCellsRelated,
  assertNanpureCellIndex,
  NANPURE_CELL_COUNT,
  type NanpureDigit,
} from "./state";

export type NanpureNotes = readonly (readonly NanpureDigit[])[];

export function createEmptyNanpureNotes(): NanpureNotes {
  return Array.from({ length: NANPURE_CELL_COUNT }, () => []);
}

export function clearNanpureCellNotes(
  notes: NanpureNotes,
  cellIndex: number,
): NanpureNotes {
  assertNanpureCellIndex(cellIndex);
  const cellNotes = notes[cellIndex] ?? [];
  if (cellNotes.length === 0) {
    return notes;
  }

  return notes.map((notesAtCell, index) =>
    index === cellIndex ? [] : notesAtCell,
  );
}

export function toggleNanpureNoteDigit(
  notes: NanpureNotes,
  cellIndex: number,
  digit: NanpureDigit,
): NanpureNotes {
  assertNanpureCellIndex(cellIndex);
  const currentNotes = notes[cellIndex] ?? [];
  const nextCellNotes = currentNotes.includes(digit)
    ? currentNotes.filter((note) => note !== digit)
    : [...currentNotes, digit].sort((left, right) => left - right);

  return notes.map((cellNotes, index) =>
    index === cellIndex ? nextCellNotes : cellNotes,
  );
}

export function clearNanpureNotesForCorrectEntry(
  notes: NanpureNotes,
  cellIndex: number,
  digit: NanpureDigit,
): NanpureNotes {
  assertNanpureCellIndex(cellIndex);

  return notes.map((cellNotes, index) => {
    if (index === cellIndex) {
      return cellNotes.length > 0 ? [] : cellNotes;
    }

    if (
      !areNanpureCellsRelated(cellIndex, index) ||
      !cellNotes.includes(digit)
    ) {
      return cellNotes;
    }

    return cellNotes.filter((note) => note !== digit);
  });
}
