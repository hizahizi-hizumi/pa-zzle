import { Flag, MousePointerClick } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MinesweeperInputMode } from "@/games/minesweeper/ui/board/MinesweeperBoard";

type MinesweeperInputModeControlProps = {
  mode: MinesweeperInputMode;
  onChange: (mode: MinesweeperInputMode) => void;
};

export function MinesweeperInputModeControl({
  mode,
  onChange,
}: MinesweeperInputModeControlProps) {
  function selectRevealMode(): void {
    onChange("reveal");
  }

  function selectFlagMode(): void {
    onChange("flag");
  }

  return (
    <div
      role="group"
      aria-label="操作モード"
      className="grid w-full grid-cols-2 gap-2"
    >
      <Button
        type="button"
        variant={mode === "reveal" ? "secondary" : "outline"}
        size="lg"
        aria-pressed={mode === "reveal"}
        onClick={selectRevealMode}
      >
        <MousePointerClick aria-hidden />
        開く
      </Button>
      <Button
        type="button"
        variant={mode === "flag" ? "secondary" : "outline"}
        size="lg"
        aria-pressed={mode === "flag"}
        onClick={selectFlagMode}
      >
        <Flag aria-hidden />旗
      </Button>
    </div>
  );
}
