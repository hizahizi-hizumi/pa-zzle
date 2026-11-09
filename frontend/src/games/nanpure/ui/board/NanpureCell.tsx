import { TutorialCue } from "@/components/TutorialCue";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import {
  getNanpureColumnIndex,
  getNanpureRowIndex,
  NANPURE_SIZE,
  type NanpureCell as NanpureCellValue,
  type NanpureDigit,
} from "@/games/nanpure/puzzle/board";
import type { NanpureNotes } from "@/games/nanpure/session/session";
import type { NanpureCellCue } from "@/games/nanpure/ui/board/cell-cue";
import { NanpureCellNotes } from "@/games/nanpure/ui/board/NanpureCellNotes";
import { nanpureCellToneClassNames } from "@/games/nanpure/ui/board/nanpure-cell-tone";
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
  /** チュートリアルで、このマスに重ねる印か応え。 */
  cue: NanpureCellCue | undefined;
  /** チュートリアルで手を引いている間、画面全体の覆いからこのマスを抜き、元の明るさで見せる。 */
  spotlit: boolean;
  onSelect: (cellIndex: number) => void;
};

/** 印と応えの線は、隣り合うマスの線と重ならないよう、マスの縁から少し内側に、角の立ったマスの形で引く。 */
const cueOutlinePlacementClassName = "pointer-events-none absolute inset-0.5";

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
  cue,
  spotlit,
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
        "relative flex aspect-square min-h-0 items-center justify-center font-sans text-[min(clamp(1rem,5vw,2rem),6.5cqw)] outline-none transition-colors focus-visible:bg-violet-200 dark:focus-visible:bg-violet-900/55",
        row !== NANPURE_SIZE - 1 && "border-b border-b-border",
        column !== NANPURE_SIZE - 1 && "border-r border-r-border",
        row % 3 === 2 &&
          row !== NANPURE_SIZE - 1 &&
          "border-b-2 border-b-foreground/55",
        column % 3 === 2 &&
          column !== NANPURE_SIZE - 1 &&
          "border-r-2 border-r-foreground/55",
        related && nanpureCellToneClassNames.related,
        matching && nanpureCellToneClassNames.matching,
        selected && nanpureCellToneClassNames.selected,
        clue && nanpureCellToneClassNames.clue,
        !clue && value !== null && nanpureCellToneClassNames.entered,
        mistake && nanpureCellToneClassNames.mistake,
        conflict && nanpureCellToneClassNames.conflict,
      )}
      onClick={() => onSelect(cellIndex)}
    >
      {/* マスの形のまま、角の無い四角で覆いから抜く。 */}
      <TutorialSpotlight active={spotlit} className="inset-0" />
      {cue?.kind === "fitted" && (
        <span
          aria-hidden="true"
          data-cell-cue={cue.kind}
          className={cueOutlinePlacementClassName}
        >
          <TutorialCue kind="acknowledgement" id={cue.id} />
        </span>
      )}
      {(cue?.kind === "hint" || cue?.kind === "recall") && (
        <span
          aria-hidden="true"
          data-cell-cue="hint"
          className={cueOutlinePlacementClassName}
        >
          <TutorialCue
            kind="mark"
            recallId={cue.kind === "recall" ? cue.id : null}
          />
        </span>
      )}
      {value !== null ? (
        <span data-nanpure-digit={clue ? "clue" : "entered"}>{value}</span>
      ) : (
        <NanpureCellNotes
          notes={notes}
          selectedValue={selectedValue}
          size="board"
        />
      )}
    </button>
  );
}
