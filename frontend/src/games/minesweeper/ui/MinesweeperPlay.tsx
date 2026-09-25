import { useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import type { MinesweeperDifficulty } from "../difficulty";
import type {
  MinesweeperProgress,
  MinesweeperResult,
} from "../play/use-minesweeper-play";
import type {
  MinesweeperSessionStatus,
  MinesweeperVisibleCell,
} from "../session/session";
import { MinesweeperClearAnimation } from "./board/clear/MinesweeperClearAnimation";
import {
  MinesweeperBoard,
  type MinesweeperInputMode,
} from "./board/MinesweeperBoard";
import { MinesweeperPlayHeader } from "./MinesweeperPlay/MinesweeperPlayHeader";
import { MinesweeperResultScreen } from "./result/MinesweeperResultScreen";

type MinesweeperPlayProps = {
  difficulty: MinesweeperDifficulty;
  rows: number;
  columns: number;
  mineCount: number;
  flagCount: number;
  mistakeCount: number;
  elapsedMs: number;
  visibleCells: readonly MinesweeperVisibleCell[];
  status: MinesweeperSessionStatus;
  progress: MinesweeperProgress;
  result: MinesweeperResult | null;
  onRevealCell: (cellIndex: number) => void;
  onToggleFlag: (cellIndex: number) => void;
  onChordCell: (cellIndex: number) => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onClearAnimationComplete: () => void;
  onOpenDiagnostics?: () => void;
};

export function MinesweeperPlay({
  difficulty,
  rows,
  columns,
  mineCount,
  flagCount,
  mistakeCount,
  elapsedMs,
  visibleCells,
  status,
  progress,
  result,
  onRevealCell,
  onToggleFlag,
  onChordCell,
  onReplay,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
  onClearAnimationComplete,
  onOpenDiagnostics,
}: MinesweeperPlayProps) {
  const [mode, setMode] = useState<MinesweeperInputMode>("reveal");

  function handleReplay(): void {
    setMode("reveal");
    onReplay();
  }

  function handleStartNewProblem(): void {
    setMode("reveal");
    onStartNewProblem();
  }

  if (progress === "result" && status === "cleared" && result) {
    return (
      <MinesweeperResultScreen
        difficulty={difficulty}
        result={result}
        onReplay={handleReplay}
        onStartNewProblem={handleStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenDiagnostics={onOpenDiagnostics}
      />
    );
  }

  const interactionEnabled = status === "playing" && progress === "playing";

  return (
    <section className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
      <MinesweeperPlayHeader
        mineCount={mineCount}
        flagCount={flagCount}
        mistakeCount={mistakeCount}
        elapsedMs={elapsedMs}
        inputMode={mode}
        showsInputModeToggle={interactionEnabled}
        onInputModeChange={setMode}
        onReplay={handleReplay}
        onStartNewProblem={handleStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenDiagnostics={onOpenDiagnostics}
      />
      <main className="flex min-h-0 flex-1 items-center justify-center px-2 py-3 sm:px-6">
        <div className="w-full max-w-[27rem]">
          <MinesweeperClearAnimation
            active={progress === "clearing"}
            onComplete={onClearAnimationComplete}
          >
            <MinesweeperBoard
              rows={rows}
              columns={columns}
              cells={visibleCells}
              mode={mode}
              disabled={!interactionEnabled}
              onRevealCell={onRevealCell}
              onToggleFlag={onToggleFlag}
              onChordCell={onChordCell}
            />
          </MinesweeperClearAnimation>
        </div>
      </main>
    </section>
  );
}
