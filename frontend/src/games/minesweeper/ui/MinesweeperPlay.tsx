import { useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import type {
  MinesweeperSessionStatus,
  MinesweeperVisibleCell,
} from "../session/session";
import {
  MinesweeperBoard,
  type MinesweeperInputMode,
} from "./board/MinesweeperBoard";
import { MinesweeperPlayHeader } from "./MinesweeperPlay/MinesweeperPlayHeader";
import { MinesweeperPlayStatus } from "./MinesweeperPlay/MinesweeperPlayStatus";

type MinesweeperPlayProps = {
  rows: number;
  columns: number;
  mineCount: number;
  flagCount: number;
  mistakeCount: number;
  elapsedMs: number;
  visibleCells: readonly MinesweeperVisibleCell[];
  status: MinesweeperSessionStatus;
  onRevealCell: (cellIndex: number) => void;
  onToggleFlag: (cellIndex: number) => void;
  onChordCell: (cellIndex: number) => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function MinesweeperPlay({
  rows,
  columns,
  mineCount,
  flagCount,
  mistakeCount,
  elapsedMs,
  visibleCells,
  status,
  onRevealCell,
  onToggleFlag,
  onChordCell,
  onReplay,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
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

  return (
    <section className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
      <MinesweeperPlayHeader
        mineCount={mineCount}
        flagCount={flagCount}
        mistakeCount={mistakeCount}
        elapsedMs={elapsedMs}
        inputMode={mode}
        showsInputModeToggle={status === "playing"}
        onInputModeChange={setMode}
        onReplay={handleReplay}
        onStartNewProblem={handleStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenDiagnostics={onOpenDiagnostics}
      />
      <main className="flex min-h-0 flex-1 items-center justify-center px-2 py-3 sm:px-6">
        <div className="grid w-full max-w-[27rem] gap-3">
          <MinesweeperBoard
            rows={rows}
            columns={columns}
            cells={visibleCells}
            mode={mode}
            disabled={status !== "playing"}
            onRevealCell={onRevealCell}
            onToggleFlag={onToggleFlag}
            onChordCell={onChordCell}
          />
          {status === "cleared" ? <MinesweeperPlayStatus /> : null}
        </div>
      </main>
    </section>
  );
}
