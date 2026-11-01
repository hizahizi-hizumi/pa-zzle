import { useState } from "react";

import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type { NonogramDifficulty } from "@/games/nonogram/difficulty";
import { NONOGRAM_DISPLAY_NAME } from "@/games/nonogram/display-name";
import type {
  NonogramOperation,
  NonogramResult,
} from "@/games/nonogram/play/use-nonogram-play";
import type { NonogramBoard as NonogramBoardState } from "@/games/nonogram/puzzle/board";
import type { NonogramClues } from "@/games/nonogram/puzzle/clue";
import type { NonogramLineFlags } from "@/games/nonogram/puzzle/rules";
import type {
  NonogramMark,
  NonogramStrokeRange,
} from "@/games/nonogram/session/session";
import { NonogramClearAnimation } from "@/games/nonogram/ui/board/clear/NonogramClearAnimation";
import { NonogramBoard } from "@/games/nonogram/ui/board/NonogramBoard";
import { NonogramHowToPlayDialog } from "@/games/nonogram/ui/NonogramHowToPlayDialog";
import { NonogramMarkToggle } from "@/games/nonogram/ui/NonogramPlay/NonogramMarkToggle";
import { useNonogramSoundEffects } from "@/games/nonogram/ui/NonogramPlay/use-nonogram-sound-effects";
import { NonogramResultScreen } from "@/games/nonogram/ui/result/NonogramResultScreen";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";

type NonogramPlayProps = GamePlayScreenProps<
  NonogramDifficulty,
  NonogramResult
> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    board: NonogramBoardState;
    clues: NonogramClues;
    matchedLines: NonogramLineFlags;
    strokeRange: NonogramStrokeRange | null;
    repaintCount: number;
    operation: NonogramOperation | null;
    onStartStroke: (cellIndex: number, mark: NonogramMark) => void;
    onExtendStroke: (cellIndex: number) => void;
    onEndStroke: () => void;
  };

const INITIAL_MARK: NonogramMark = "filled";

export function NonogramPlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordOutcomeNotice,
  board,
  clues,
  matchedLines,
  strokeRange,
  repaintCount,
  operation,
  canUndo,
  canRestart,
  onStartStroke,
  onExtendStroke,
  onEndStroke,
  onUndo,
  onRestart,
  onReplay,
  onClearAnimationComplete,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: NonogramPlayProps) {
  const [mark, setMark] = useState<NonogramMark>(INITIAL_MARK);
  const playing = progress === "playing";
  useNonogramSoundEffects(operation, progress);

  function handleReplay(): void {
    setMark(INITIAL_MARK);
    onReplay();
  }

  function handleStartNewProblem(): void {
    setMark(INITIAL_MARK);
    onStartNewProblem();
  }

  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={NONOGRAM_DISPLAY_NAME}
      metrics={[
        { type: "count", label: "塗り直し", count: repaintCount },
        { type: "elapsed-time", elapsedMs },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={handleReplay}
      onStartNewProblem={handleStartNewProblem}
      onChangeDifficulty={onChangeDifficulty}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
      renderHowToPlayDialog={({ open, onClose }) => (
        <NonogramHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <NonogramResultScreen
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
      <main className="flex min-h-0 flex-1 items-center justify-center px-2 py-2 [container-type:size] sm:px-4">
        <NonogramClearAnimation
          active={progress === "clearing"}
          onComplete={onClearAnimationComplete}
        >
          <NonogramBoard
            board={board}
            clues={clues}
            matchedLines={matchedLines}
            strokeRange={strokeRange}
            mark={mark}
            interactionDisabled={!playing}
            revealed={!playing}
            onStartStroke={onStartStroke}
            onExtendStroke={onExtendStroke}
            onEndStroke={onEndStroke}
          />
        </NonogramClearAnimation>
      </main>
      <footer className="grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 pb-2">
        <span aria-hidden="true" />
        <UndoButton disabled={!canUndo} onUndo={onUndo} />
        <div className="justify-self-start">
          <NonogramMarkToggle
            mark={mark}
            disabled={!playing}
            onChange={setMark}
          />
        </div>
      </footer>
    </GamePlayFrame>
  );
}
