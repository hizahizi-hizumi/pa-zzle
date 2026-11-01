import { Undo2 } from "lucide-react";

import { useTouchTap } from "@/components/touch-tap";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

type UndoButtonProps = {
  disabled: boolean;
  onUndo: () => void;
};

/**
 * 待ったのボタン。盤面をなぞった指を離した直後に押しても届くよう、タッチは指を離したときに受ける（`useTouchTap`）。
 */
export function UndoButton({ disabled, onUndo }: UndoButtonProps) {
  const { getTapHandlers } = useTouchTap();

  return (
    <button
      type="button"
      className="inline-flex size-12 items-center justify-center rounded-full border-(length:--border-width-normal) bg-background shadow-raised transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      aria-label={PLAY_OPERATION_LABELS.undo}
      {...getTapHandlers(onUndo)}
      disabled={disabled}
    >
      <Undo2 className="size-5" />
    </button>
  );
}
