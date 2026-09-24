import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MinesweeperInputMode } from "../board/MinesweeperBoard";
import { InputModeToggle } from "./MinesweeperPlayHeader/InputModeToggle";
import { PlayHeaderSummary } from "./MinesweeperPlayHeader/PlayHeaderSummary";
import { PlayMenu } from "./MinesweeperPlayHeader/PlayMenu";

type MinesweeperPlayHeaderProps = {
  mineCount: number;
  flagCount: number;
  inputMode: MinesweeperInputMode;
  showsInputModeToggle: boolean;
  onInputModeChange: (mode: MinesweeperInputMode) => void;
  onReplay: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
};

export function MinesweeperPlayHeader({
  mineCount,
  flagCount,
  inputMode,
  showsInputModeToggle,
  onInputModeChange,
  onReplay,
  onChangeDifficulty,
  onBackToHome,
}: MinesweeperPlayHeaderProps) {
  return (
    <header className="grid h-[4.5rem] shrink-0 grid-cols-[5.25rem_minmax(0,1fr)_5.25rem] items-start bg-background px-3 pt-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="難易度選択へ戻る"
        onClick={onChangeDifficulty}
      >
        <ArrowLeft />
      </Button>
      <PlayHeaderSummary mineCount={mineCount} flagCount={flagCount} />
      <div className="flex justify-end gap-1">
        {showsInputModeToggle ? (
          <InputModeToggle mode={inputMode} onChange={onInputModeChange} />
        ) : null}
        <PlayMenu
          onReplay={onReplay}
          onChangeDifficulty={onChangeDifficulty}
          onBackToHome={onBackToHome}
        />
      </div>
    </header>
  );
}
