import { Flag, Pointer } from "lucide-react";

import type { MinesweeperInputMode } from "@/games/minesweeper/ui/board/MinesweeperBoard";
import { cn } from "@/lib/utils";

type InputModeSwitchProps = {
  mode: MinesweeperInputMode;
  onChange: (mode: MinesweeperInputMode) => void;
};

const halfClassName =
  "flex items-center justify-center gap-1.5 rounded-md transition-colors duration-(--duration-fast) [&_svg]:size-5";
const activeHalfClassName = "bg-background text-foreground shadow-sm";

/**
 * 盤面の下に置く、親指で押しやすい大きさの旗モードの切り替え。押すたびに開くと旗を入れ替え、今の入力を左右の明るい面で示す。
 */
export function InputModeSwitch({ mode, onChange }: InputModeSwitchProps) {
  const isFlagMode = mode === "flag";

  return (
    <button
      type="button"
      aria-label="旗モード"
      aria-pressed={isFlagMode}
      className="grid h-10 w-[min(100%,16rem)] touch-manipulation select-none grid-cols-2 gap-1 rounded-lg bg-muted p-1 font-medium text-muted-foreground text-supporting outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onChange(isFlagMode ? "reveal" : "flag")}
    >
      <span
        aria-hidden="true"
        className={cn(halfClassName, !isFlagMode && activeHalfClassName)}
      >
        <Pointer />
        開く
      </span>
      <span
        aria-hidden="true"
        className={cn(
          halfClassName,
          isFlagMode && `${activeHalfClassName} text-red-600 dark:text-red-400`,
        )}
      >
        <Flag className={cn(isFlagMode && "fill-current")} />旗
      </span>
    </button>
  );
}
