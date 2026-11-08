import { useState } from "react";
import { useLocation } from "react-router";

import { GamePlayFrame } from "@/components/GamePlayFrame";
import type { MinesweeperDifficulty } from "@/games/minesweeper/difficulty";
import { MINESWEEPER_DISPLAY_NAME } from "@/games/minesweeper/display-name";
import type {
  MinesweeperOperation,
  MinesweeperResult,
} from "@/games/minesweeper/play/use-minesweeper-play";
import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";
import { MinesweeperClearAnimation } from "@/games/minesweeper/ui/board/clear/MinesweeperClearAnimation";
import {
  MinesweeperBoard,
  type MinesweeperInputMode,
} from "@/games/minesweeper/ui/board/MinesweeperBoard";
import type { MinesweeperVisualStyle } from "@/games/minesweeper/ui/board/MinesweeperCellFace";
import { MinesweeperHowToPlayDialog } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog";
import { ExperienceCompare } from "@/games/minesweeper/ui/MinesweeperPlay/ExperienceCompare";
import { InputModeToggle } from "@/games/minesweeper/ui/MinesweeperPlay/InputModeToggle";
import { useMinesweeperSoundEffects } from "@/games/minesweeper/ui/MinesweeperPlay/use-minesweeper-sound-effects";
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
  operation: MinesweeperOperation | null;
  onRevealCell: (cellIndex: number) => void;
  onToggleFlag: (cellIndex: number) => void;
  onChordCell: (cellIndex: number) => void;
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
  operation,
  onRevealCell,
  onToggleFlag,
  onChordCell,
  onReplay,
  onStartNewProblem,
  onOpenGameHome,
  onBackToHome,
  onClearAnimationComplete,
  onOpenDiagnostics,
}: MinesweeperPlayProps) {
  const [mode, setMode] = useState<MinesweeperInputMode>("reveal");
  const location = useLocation();
  const compareEnabled =
    new URLSearchParams(location.search).get("experience") === "compare";
  const [visualStyle, setVisualStyle] =
    useState<MinesweeperVisualStyle>("hybrid");
  const interactionEnabled = progress === "playing";
  useMinesweeperSoundEffects(operation, progress);

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
      background={
        <div
          className={
            visualStyle === "ink"
              ? "size-full bg-[#e7e8e4] dark:bg-[#1d272b]"
              : visualStyle === "relief"
                ? "size-full bg-[#e3e6e0] dark:bg-[#20282a]"
                : "size-full bg-[#f0f1f3] dark:bg-[#20242b]"
          }
        />
      }
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
      onOpenGameHome={onOpenGameHome}
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
          onOpenGameHome={onOpenGameHome}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      )}
    >
      <main className="flex min-h-0 flex-1 items-center justify-center px-2 py-3 sm:px-6">
        <div
          className={
            visualStyle === "classic"
              ? "w-full max-w-[27rem]"
              : "w-full max-w-[32rem]"
          }
        >
          {compareEnabled && (
            <ExperienceCompare value={visualStyle} onChange={setVisualStyle} />
          )}
          <MinesweeperClearAnimation
            active={progress === "clearing"}
            onComplete={onClearAnimationComplete}
          >
            <MinesweeperBoard
              rows={rows}
              columns={columns}
              cells={visibleCells}
              mode={mode}
              visualStyle={visualStyle}
              operation={operation}
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
