import { Flag, Pointer } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MinesweeperInputMode } from "../../board/MinesweeperBoard";

type InputModeToggleProps = {
  mode: MinesweeperInputMode;
  onChange: (mode: MinesweeperInputMode) => void;
};

export function InputModeToggle({ mode, onChange }: InputModeToggleProps) {
  const isFlagMode = mode === "flag";

  function toggleMode(): void {
    onChange(isFlagMode ? "reveal" : "flag");
  }

  return (
    <Button
      type="button"
      variant={isFlagMode ? "secondary" : "ghost"}
      size="icon-lg"
      aria-label="旗モード"
      aria-pressed={isFlagMode}
      onClick={toggleMode}
    >
      {isFlagMode ? <Flag aria-hidden /> : <Pointer aria-hidden />}
    </Button>
  );
}
