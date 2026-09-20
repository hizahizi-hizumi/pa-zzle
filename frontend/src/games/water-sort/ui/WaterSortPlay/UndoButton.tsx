import { Undo2 } from "lucide-react";

type UndoButtonProps = {
  disabled: boolean;
  onUndo: () => void;
};

export function UndoButton({ disabled, onUndo }: UndoButtonProps) {
  return (
    <button
      type="button"
      className="inline-flex size-12 items-center justify-center rounded-full border bg-background shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      aria-label="待った"
      onClick={onUndo}
      disabled={disabled}
    >
      <Undo2 className="size-5" />
    </button>
  );
}
