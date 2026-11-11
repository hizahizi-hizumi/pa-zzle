import { Eraser, Pencil, Undo2 } from "lucide-react";
import { PlayActionButton } from "@/components/PlayActionButton";
import type { NanpureDigit } from "@/games/nanpure/puzzle/board";
import { NanpureDigitPad } from "@/games/nanpure/ui/play/NanpureDigitPad";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

/** メモを入れている間の地と文字の色。メモの数字と同じ紫で示す。 */
const NOTES_MODE_ACTIVE_CLASS_NAME =
  "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300";

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
            activeClassName={NOTES_MODE_ACTIVE_CLASS_NAME}
            onClick={onToggleNotesMode}
            disabled={!interactionEnabled}
          />
        </div>
        <NanpureDigitPad
          notesMode={notesMode}
          canEnterDigit={canEnterDigit}
          completedDigits={completedDigits}
          onInputDigit={onInputDigit}
        />
      </div>
    </footer>
  );
}
