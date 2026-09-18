import { Eraser, Pencil, Undo2 } from "lucide-react";
import type { ReactNode } from "react";

import { NANPURE_DIGITS, type NanpureDigit } from "@/games/nanpure/game/state";
import { cn } from "@/lib/utils";

type NanpureInputPanelProps = {
  notesMode: boolean;
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
    <footer className="shrink-0 px-3 pb-3 pt-2">
      <div className="mx-auto grid w-full max-w-xl gap-3">
        <div className="grid grid-cols-3">
          <PlayActionButton
            icon={<Undo2 />}
            label="待った"
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
                "h-14 min-w-0 rounded-lg px-0 text-[clamp(1.5rem,7vw,2.25rem)] tabular-nums transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none disabled:pointer-events-none disabled:text-muted-foreground/20",
                notesMode
                  ? "font-medium text-violet-400/75 dark:text-violet-400/70"
                  : "font-medium text-violet-600 dark:text-violet-300",
              )}
              onClick={() => onInputDigit(digit)}
              disabled={!canEnterDigit || completedDigitSet.has(digit)}
            >
              {digit}
            </button>
          ))}
        </fieldset>
      </div>
    </footer>
  );
}

function PlayActionButton({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active || undefined}
      className={cn(
        "relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35",
        active &&
          "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <span aria-hidden="true" className="[&>svg]:size-6">
        {icon}
      </span>
      <span className="text-[11px] leading-none">{label}</span>
    </button>
  );
}
