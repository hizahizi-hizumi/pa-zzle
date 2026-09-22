import {
  getNanpureColumnIndex,
  getNanpureRowIndex,
  NANPURE_SIZE,
  type NanpureCell as NanpureCellValue,
  type NanpureDigit,
} from "@/games/nanpure/puzzle/board";
import type { NanpureNotes } from "@/games/nanpure/session/session";
import { NanpureCellNotes } from "@/games/nanpure/ui/board/NanpureCell/NanpureCellNotes";
import { cn } from "@/lib/utils";

type NanpureCellProps = {
  cellIndex: number;
  value: NanpureCellValue;
  clue: boolean;
  notes: NanpureNotes[number];
  selectedValue: NanpureDigit | null;
  selected: boolean;
  related: boolean;
  matching: boolean;
  conflict: boolean;
  mistake: boolean;
  disabled: boolean;
  onSelect: (cellIndex: number) => void;
};

function getCellLabel({
  cellIndex,
  value,
  clue,
  notes,
  conflict,
  mistake,
}: Pick<
  NanpureCellProps,
  "cellIndex" | "value" | "clue" | "notes" | "conflict" | "mistake"
>): string {
  const row = getNanpureRowIndex(cellIndex) + 1;
  const column = getNanpureColumnIndex(cellIndex) + 1;
  const prefix = `${row}行${column}列`;

  if (value !== null) {
    const source = clue ? "、初期ヒント" : "";
    const states = [mistake ? "誤り" : null, conflict ? "競合" : null]
      .filter((state) => state !== null)
      .join("、");
    return `${prefix}、${value}${source}${states ? `、${states}` : ""}`;
  }

  return notes.length > 0
    ? `${prefix}、空き、メモ ${notes.join("、")}`
    : `${prefix}、空き`;
}

export function NanpureCell({
  cellIndex,
  value,
  clue,
  notes,
  selectedValue,
  selected,
  related,
  matching,
  conflict,
  mistake,
  disabled,
  onSelect,
}: NanpureCellProps) {
  const row = getNanpureRowIndex(cellIndex);
  const column = getNanpureColumnIndex(cellIndex);

  return (
    <button
      type="button"
      aria-label={getCellLabel({
        cellIndex,
        value,
        clue,
        notes,
        conflict,
        mistake,
      })}
      aria-pressed={selected}
      aria-invalid={conflict || mistake || undefined}
      disabled={disabled}
      className={cn(
        "relative flex aspect-square min-h-0 items-center justify-center font-sans text-[clamp(1rem,5vw,2rem)] outline-none transition-colors focus-visible:bg-violet-200 dark:focus-visible:bg-violet-900/55",
        row !== NANPURE_SIZE - 1 && "border-b border-b-border",
        column !== NANPURE_SIZE - 1 && "border-r border-r-border",
        row % 3 === 2 &&
          row !== NANPURE_SIZE - 1 &&
          "border-b-2 border-b-foreground/55",
        column % 3 === 2 &&
          column !== NANPURE_SIZE - 1 &&
          "border-r-2 border-r-foreground/55",
        related && "bg-violet-100/70 dark:bg-violet-950/35",
        matching && "bg-violet-200/75 dark:bg-violet-900/50",
        selected && "bg-violet-300/80 dark:bg-violet-800/60",
        clue && "font-semibold text-foreground",
        !clue &&
          value !== null &&
          "font-medium text-violet-600 dark:text-violet-300",
        mistake &&
          "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",
        conflict &&
          "bg-rose-100 text-rose-700 dark:bg-rose-950/45 dark:text-rose-300",
      )}
      onClick={() => onSelect(cellIndex)}
    >
      {value ?? (
        <NanpureCellNotes notes={notes} selectedValue={selectedValue} />
      )}
    </button>
  );
}
