import { type ReactNode, useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { PlayHeader } from "@/components/PlayHeader";
import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import type { MinesweeperResult } from "@/games/minesweeper/play/use-minesweeper-play";
import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";
import { MinesweeperClearAnimation } from "@/games/minesweeper/ui/board/clear/MinesweeperClearAnimation";
import {
  MinesweeperBoard,
  type MinesweeperInputMode,
} from "@/games/minesweeper/ui/board/MinesweeperBoard";
import { MinesweeperHowToPlayDialog } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog";
import { InputModeToggle } from "@/games/minesweeper/ui/MinesweeperPlay/InputModeToggle";
import { MinesweeperResultScreen } from "@/games/minesweeper/ui/result/MinesweeperResultScreen";
import type { GameProgress } from "@/games/play";
import type { GameSessionStatus } from "@/games/session";
import { formatElapsedTime } from "@/lib/format-elapsed-time";

type MinesweeperPlayProps = {
  difficulty: MinesweeperDifficulty;
  rows: number;
  columns: number;
  mineCount: number;
  flagCount: number;
  mistakeCount: number;
  elapsedMs: number;
  visibleCells: readonly MinesweeperVisibleCell[];
  status: GameSessionStatus;
  progress: GameProgress;
  result: MinesweeperResult | null;
  recordOutcomeNotice: ReactNode;
  onRevealCell: (cellIndex: number) => void;
  onToggleFlag: (cellIndex: number) => void;
  onChordCell: (cellIndex: number) => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
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
  recordOutcomeNotice,
  onRevealCell,
  onToggleFlag,
  onChordCell,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onClearAnimationComplete,
  onOpenDiagnostics,
}: MinesweeperPlayProps) {
  const [mode, setMode] = useState<MinesweeperInputMode>("reveal");
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

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
        recordOutcomeNotice={recordOutcomeNotice}
        onReplay={handleReplay}
        onStartNewProblem={handleStartNewProblem}
        onOpenRecords={onOpenRecords}
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
      <PlayHeader
        title="マインスイーパー"
        metricGroups={[
          [
            { label: "地雷", value: String(mineCount) },
            { label: "旗", value: String(flagCount) },
          ],
          [
            { label: "ミス", value: String(mistakeCount) },
            { label: "時間", value: formatElapsedTime(elapsedMs) },
          ],
        ]}
        trailingAction={
          interactionEnabled ? (
            <InputModeToggle mode={mode} onChange={setMode} />
          ) : null
        }
        onReplay={handleReplay}
        onStartNewProblem={handleStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenHowToPlay={() => setHowToPlayOpen(true)}
        onOpenDiagnostics={onOpenDiagnostics}
      />
      <MinesweeperHowToPlayDialog
        open={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
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
