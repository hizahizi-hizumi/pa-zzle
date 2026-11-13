import { useState } from "react";

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
  getMinesweeperBoardFittingWidth,
  MinesweeperBoard,
  type MinesweeperInputMode,
} from "@/games/minesweeper/ui/board/MinesweeperBoard";
import { MinesweeperGround } from "@/games/minesweeper/ui/MinesweeperGround";
import { MinesweeperHowToPlayDialog } from "@/games/minesweeper/ui/MinesweeperHowToPlayDialog";
import { InputModeSwitch } from "@/games/minesweeper/ui/MinesweeperPlay/InputModeSwitch";
import { MinesweeperTutorial } from "@/games/minesweeper/ui/MinesweeperTutorial";
import { MinesweeperResultScreen } from "@/games/minesweeper/ui/result/MinesweeperResultScreen";
import { useMinesweeperSoundEffects } from "@/games/minesweeper/ui/use-minesweeper-sound-effects";
import type { GamePlayScreenProps } from "@/games/play";
import { cn } from "@/lib/utils";

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
  recordFeedback,
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
  onBackToAppHome,
  onClearAnimationComplete,
  onOpenDiagnostics,
}: MinesweeperPlayProps) {
  const [mode, setMode] = useState<MinesweeperInputMode>("reveal");
  const interactionEnabled = progress === "playing";
  useMinesweeperSoundEffects(operation, progress, columns);

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
      background={<MinesweeperGround />}
      metrics={[
        { type: "count", label: "地雷", count: mineCount },
        { type: "count", label: "旗", count: flagCount },
        { type: "count", label: "ミス", count: mistakeCount },
        { type: "elapsed-time", elapsedMs },
      ]}
      onReplay={handleReplay}
      onStartNewProblem={handleStartNewProblem}
      onOpenGameHome={onOpenGameHome}
      onBackToAppHome={onBackToAppHome}
      onOpenDiagnostics={onOpenDiagnostics}
      renderHowToPlayDialog={({ open, onClose }) => (
        <MinesweeperHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderTutorial={({ open, onClose }) => (
        <MinesweeperTutorial open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <MinesweeperResultScreen
          difficulty={difficulty}
          result={clearedResult}
          recordFeedback={recordFeedback}
          onReplay={handleReplay}
          onStartNewProblem={handleStartNewProblem}
          onOpenGameHome={onOpenGameHome}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      )}
    >
      {/* 縦に長い盤面でも見出しと切り替えに重ならないよう、盤面を置き場所の高さにも収める。 */}
      <main className="flex min-h-0 flex-1 items-center justify-center px-2 sm:px-6 [container-type:size]">
        <div
          style={{
            width: getMinesweeperBoardFittingWidth(rows, columns, "32rem"),
          }}
        >
          <MinesweeperClearAnimation
            active={progress === "clearing"}
            columns={columns}
            originCellIndex={operation?.cellIndex ?? null}
            onComplete={onClearAnimationComplete}
          >
            <MinesweeperBoard
              rows={rows}
              columns={columns}
              cells={visibleCells}
              mode={mode}
              operation={operation}
              interactionDisabled={!interactionEnabled}
              onRevealCell={onRevealCell}
              onToggleFlag={onToggleFlag}
              onChordCell={onChordCell}
            />
          </MinesweeperClearAnimation>
        </div>
      </main>
      {/* 解き終えた後も高さを残し、盤面の位置を動かさない。 */}
      <footer
        aria-hidden={!interactionEnabled || undefined}
        inert={!interactionEnabled}
        className={cn(
          "flex shrink-0 justify-center px-4 pt-1",
          !interactionEnabled && "invisible",
        )}
      >
        <InputModeSwitch mode={mode} onChange={setMode} />
      </footer>
    </GamePlayFrame>
  );
}
