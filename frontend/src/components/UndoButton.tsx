import { Undo2 } from "lucide-react";

import { useTouchTap } from "@/components/touch-tap";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

type UndoButtonProps = {
  disabled: boolean;
  onUndo: () => void;
};

export function UndoButton({ disabled, onUndo }: UndoButtonProps) {
  const { getTapHandlers } = useTouchTap();

  return (
    <button
      type="button"
      className="inline-flex size-12 items-center justify-center rounded-full border-(length:--border-width-normal) bg-background transition-colors hover:bg-accent hover:text-accent-foreground outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50"
      aria-label={PLAY_OPERATION_LABELS.undo}
      // 盤面をなぞった指を離した直後に押しても届くよう、タッチは指を離したときに受ける（`useTouchTap`）。
      {...getTapHandlers(onUndo)}
      disabled={disabled}
    >
      <Undo2 className="size-5" />
    </button>
  );
}
