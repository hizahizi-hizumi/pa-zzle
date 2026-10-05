import { useState } from "react";

import { GamePlayFrame } from "@/components/GamePlayFrame";
import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import { MINESWEEPER_DISPLAY_NAME } from "@/games/minesweeper/display-name";
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
import type { GamePlayScreenProps } from "@/games/play";

type MinesweeperPlayProps = GamePlayScreenProps<
  MinesweeperDifficulty,
  MinesweeperResult
> & {
  rows: number;
  columns: number;
  mineCount: number;
  flagCount: number;
  mistakeCount: number;
  visibleCells: readonly MinesweeperVisibleCell[];
  onRevealCell: (cellIndex: number) => void;
  onToggleFlag: (cellIndex: number) => void;
  onChordCell: (cellIndex: number) => void;
  onClearAnimationComplete: () => void;
};

export function MinesweeperPlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordOutcomeNotice,
  rows,
  columns,
  mineCount,
  flagCount,
  mistakeCount,
  visibleCells,
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
  const interactionEnabled = progress === "playing";

  function handleReplay(): void {
    setMode("reveal");
    onReplay();
  }

  function handleStartNewProblem(): void {
    setMode("reveal");
    onStartNewProblem();
  }

  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={MINESWEEPER_DISPLAY_NAME}
      metrics={[
        { type: "count", label: "地雷", count: mineCount },
        { type: "count", label: "旗", count: flagCount },
        { type: "count", label: "ミス", count: mistakeCount },
        { type: "elapsed-time", elapsedMs },
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
      onOpenDiagnostics={onOpenDiagnostics}
      renderHowToPlayDialog={({ open, onClose }) => (
        <MinesweeperHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <MinesweeperResultScreen
          difficulty={difficulty}
          result={clearedResult}
          recordOutcomeNotice={recordOutcomeNotice}
          onReplay={handleReplay}
          onStartNewProblem={handleStartNewProblem}
          onOpenRecords={onOpenRecords}
          onChangeDifficulty={onChangeDifficulty}
          onBackToHome={onBackToHome}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      )}
    >
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
              interactionDisabled={!interactionEnabled}
              onRevealCell={onRevealCell}
              onToggleFlag={onToggleFlag}
              onChordCell={onChordCell}
            />
          </MinesweeperClearAnimation>
        </div>
      </main>
    </GamePlayFrame>
  );
}
