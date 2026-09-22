import { Flag, MousePointerClick } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MinesweeperInputMode } from "../board/MinesweeperBoard";

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
    <div className="grid justify-items-center gap-2">
      <div role="group" aria-label="操作モード" className="flex gap-2">
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
      <p className="text-meta text-muted-foreground">
        長押し / 右クリックでも旗
      </p>
    </div>
  );
}
