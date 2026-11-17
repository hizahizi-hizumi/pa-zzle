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
import { getNanpureCellAccessibleName } from "@/games/nanpure/ui/board/cell-accessible-name";
import type { NanpureCellCue } from "@/games/nanpure/ui/board/cell-cue";
import { NanpureCellNotes } from "@/games/nanpure/ui/board/NanpureCellNotes";
import {
  getNanpureCellLineClassName,
  getNanpureCellToneClassName,
  nanpureCellFocusClassName,
} from "@/games/nanpure/ui/board/nanpure-cell-tone";
import { cn } from "@/lib/utils";

type NanpureCellProps = {
  cellIndex: number;
  value: NanpureCellValue;
  clue: boolean;
  notes: NanpureNotes[number];
  selectedValue: NanpureDigit | null;
  selected: boolean;
  sameUnitAsSelected: boolean;
  sameDigitAsSelected: boolean;
  conflict: boolean;
  mistake: boolean;
  disabled: boolean;
  cue: NanpureCellCue | undefined;
  /** チュートリアルで、盤面の覆いからこのマスを抜き、元の明るさで見せる。 */
  spotlit: boolean;
  onSelect: (cellIndex: number) => void;
};

/** 印と応えの線は、隣り合うマスの線と重ならないよう、マスの縁から少し内側に、角の立ったマスの形で引く。 */
const cueOutlinePlacementClassName = "pointer-events-none absolute inset-0.5";

export function NanpureCell({
  cellIndex,
  value,
  clue,
  notes,
  selectedValue,
  selected,
  sameUnitAsSelected,
  sameDigitAsSelected,
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
      aria-label={getNanpureCellAccessibleName({
        row: row + 1,
        column: column + 1,
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
        "relative flex aspect-square min-h-0 items-center justify-center font-sans text-[min(clamp(1rem,5vw,2rem),6.5cqw)] transition-colors",
        nanpureCellFocusClassName,
        getNanpureCellLineClassName({
          row,
          column,
          lastRow: NANPURE_SIZE - 1,
          lastColumn: NANPURE_SIZE - 1,
        }),
        getNanpureCellToneClassName({
          selected,
          sameUnitAsSelected,
          sameDigitAsSelected,
          value,
          clue,
          mistake,
          conflict,
        }),
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
