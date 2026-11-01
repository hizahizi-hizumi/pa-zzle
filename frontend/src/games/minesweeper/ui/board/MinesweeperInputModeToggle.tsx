import { Flag, Pointer } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MinesweeperInputMode } from "@/games/minesweeper/ui/board/MinesweeperBoard";

type MinesweeperInputModeToggleProps = {
  mode: MinesweeperInputMode;
  /** チュートリアルで、次に押すところとして印を付ける。 */
  cued?: boolean;
  /** `cued` の印を付け直す目印。変わると、同じ印でも出し直す。 */
  cueId?: number;
  disabled?: boolean;
  onChange: (mode: MinesweeperInputMode) => void;
};

/** マスを押したときに開くか、旗を置く・外すかを切り替える。 */
export function MinesweeperInputModeToggle({
  mode,
  cued = false,
  cueId = 0,
  disabled = false,
  onChange,
}: MinesweeperInputModeToggleProps) {
  const isFlagMode = mode === "flag";

  function toggleMode(): void {
    onChange(isFlagMode ? "reveal" : "flag");
  }

  return (
    <span className="relative flex">
      <Button
        type="button"
        variant={isFlagMode ? "secondary" : "ghost"}
        size="icon-lg"
        aria-label="旗モード"
        aria-pressed={isFlagMode}
        disabled={disabled}
        onClick={toggleMode}
      >
        {isFlagMode ? <Flag aria-hidden /> : <Pointer aria-hidden />}
      </Button>
      {cued && (
        <span
          key={cueId}
          aria-hidden="true"
          data-mode-cue="hint"
          className="pointer-events-none absolute -inset-0.5 rounded-md border-[3px] border-sky-600 border-dashed animate-in fade-in-0 duration-(--duration-normal) ease-(--ease-enter) motion-reduce:animate-none dark:border-sky-400"
        />
      )}
    </span>
  );
}
