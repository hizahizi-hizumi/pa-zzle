import { Eraser, Pencil, Undo2 } from "lucide-react";
import {
  NANPURE_DIGITS,
  type NanpureDigit,
} from "@/games/nanpure/puzzle/board";
import { PlayActionButton } from "@/games/nanpure/ui/play/NanpureInputPanel/PlayActionButton";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";
import { cn } from "@/lib/utils";

type NanpureInputPanelProps = {
  notesMode: boolean;
  digitFirst?: boolean;
  selectedDigit?: NanpureDigit | null;
  interactionEnabled: boolean;
  selectedIsEditable: boolean;
  selectedHasAnswer: boolean;
  selectedHasNotes: boolean;
  completedDigits: readonly NanpureDigit[];
  canUndo: boolean;
  onUndo: () => void;
  onErase: () => void;
  onToggleNotesMode: () => void;
  onInputDigit: (digit: NanpureDigit) => void;
};

export function NanpureInputPanel({
  notesMode,
  digitFirst = false,
  selectedDigit = null,
  interactionEnabled,
  selectedIsEditable,
  selectedHasAnswer,
  selectedHasNotes,
  completedDigits,
  canUndo,
  onUndo,
  onErase,
  onToggleNotesMode,
  onInputDigit,
}: NanpureInputPanelProps) {
  const completedDigitSet = new Set(completedDigits);
  const canEnterDigit =
    interactionEnabled &&
    selectedIsEditable &&
    (!notesMode || !selectedHasAnswer);

  return (
    <footer className="shrink-0 px-3 pb-3 pt-2 lg:w-[22rem] lg:px-0 lg:py-0">
      <div className="mx-auto grid w-full max-w-xl gap-3">
        <div className="grid grid-cols-3">
          <PlayActionButton
            icon={<Undo2 />}
            label={PLAY_OPERATION_LABELS.undo}
            onClick={onUndo}
            disabled={!interactionEnabled || !canUndo}
          />
          <PlayActionButton
            icon={<Eraser />}
            label="消す"
            onClick={onErase}
            disabled={
              !interactionEnabled ||
              !selectedIsEditable ||
              (!selectedHasAnswer && !selectedHasNotes)
            }
          />
          <PlayActionButton
            icon={<Pencil />}
            label="メモ"
            active={notesMode}
            onClick={onToggleNotesMode}
            disabled={!interactionEnabled}
          />
        </div>
        <fieldset className="grid grid-cols-9 gap-x-1">
          <legend className="sr-only">数字入力</legend>
          {NANPURE_DIGITS.map((digit) => (
            <button
              key={digit}
              type="button"
              className={cn(
                "h-14 min-w-0 rounded-md px-0 font-sans text-[clamp(1.5rem,7vw,2.25rem)] tabular-nums transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none disabled:pointer-events-none disabled:text-muted-foreground/20",
                notesMode
                  ? "font-medium text-violet-400/75 dark:text-violet-400/70"
                  : "font-medium text-violet-600 dark:text-violet-300",
                digitFirst &&
                  selectedDigit === digit &&
                  "bg-violet-200/70 ring-2 ring-inset ring-violet-500 dark:bg-violet-800/50",
              )}
              aria-pressed={digitFirst ? selectedDigit === digit : undefined}
              onClick={() => onInputDigit(digit)}
              disabled={
                (!digitFirst && !canEnterDigit) ||
                !interactionEnabled ||
                completedDigitSet.has(digit)
              }
            >
              {digit}
            </button>
          ))}
        </fieldset>
      </div>
    </footer>
  );
}
