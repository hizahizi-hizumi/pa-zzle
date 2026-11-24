import { GamePlayFrame } from "@/components/GamePlayFrame";
import { UndoButton } from "@/components/UndoButton";
import type { MagicSquareDifficulty } from "@/games/magic-square/difficulty";
import { MAGIC_SQUARE_DISPLAY_NAME } from "@/games/magic-square/display-name";
import type {
  MagicSquareOperation,
  MagicSquareResult,
} from "@/games/magic-square/play/use-magic-square-play";
import type { MagicSquareBoard as MagicSquareBoardCells } from "@/games/magic-square/puzzle/board";
import type {
  MagicSquareLineEvaluation,
  MagicSquareValueState,
} from "@/games/magic-square/puzzle/rules";
import type { MagicSquareState } from "@/games/magic-square/puzzle/state";
import type { MagicSquareInputMode } from "@/games/magic-square/session/session";
import { MagicSquareBoard } from "@/games/magic-square/ui/board/MagicSquareBoard";
import { MagicSquareGround } from "@/games/magic-square/ui/MagicSquareGround";
import { MagicSquareHowToPlayDialog } from "@/games/magic-square/ui/MagicSquareHowToPlayDialog";
import { MagicSquareMemoToggle } from "@/games/magic-square/ui/MagicSquareMemoToggle";
import { MagicSquareNumberPad } from "@/games/magic-square/ui/MagicSquareNumberPad";
import { MagicSquareTutorial } from "@/games/magic-square/ui/MagicSquareTutorial";
import { splitMagicSquareRejection } from "@/games/magic-square/ui/magic-square-rejection";
import { MagicSquareResultScreen } from "@/games/magic-square/ui/result/MagicSquareResultScreen";
import { useMagicSquareSoundEffects } from "@/games/magic-square/ui/use-magic-square-sound-effects";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";

type MagicSquarePlayProps = GamePlayScreenProps<
  MagicSquareDifficulty,
  MagicSquareResult
> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    givens: MagicSquareBoardCells;
    /** 最初から置いてある数を含む今の盤面と、マスごとのメモ。 */
    board: MagicSquareState;
    selectedCellIndex: number | null;
    lineEvaluations: readonly MagicSquareLineEvaluation[];
    inputMode: MagicSquareInputMode;
    valueStates: readonly MagicSquareValueState[];
    correctionCount: number;
    operation: MagicSquareOperation | null;
    onSelectCell: (cellIndex: number) => void;
    onEnterValue: (value: number) => void;
    onToggleMemoInput: () => void;
  };

export function MagicSquarePlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordFeedback,
  givens,
  board,
  selectedCellIndex,
  lineEvaluations,
  inputMode,
  valueStates,
  correctionCount,
  operation,
  onSelectCell,
  onEnterValue,
  onToggleMemoInput,
  canUndo,
  onUndo,
  canRestart,
  onRestart,
  onReplay,
  onStartNewProblem,
  onClearAnimationComplete,
  onOpenGameHome,
  onBackToAppHome,
  onOpenHowToPlay,
  onOpenTutorial,
  onOpenDiagnostics,
  renderSettingsDialog,
}: MagicSquarePlayProps) {
  const playing = progress === "playing";
  const rejection = splitMagicSquareRejection(operation);
  useMagicSquareSoundEffects(operation, progress);

  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={MAGIC_SQUARE_DISPLAY_NAME}
      background={<MagicSquareGround />}
      metrics={[
        { type: "count", label: "置き直し", count: correctionCount },
        { type: "elapsed-time", elapsedMs },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onOpenGameHome={onOpenGameHome}
      onBackToAppHome={onBackToAppHome}
      onOpenHowToPlay={onOpenHowToPlay}
      onOpenTutorial={onOpenTutorial}
      onOpenDiagnostics={onOpenDiagnostics}
      renderSettingsDialog={renderSettingsDialog}
      renderHowToPlayDialog={({ open, onClose, onOpenTutorial }) => (
        <MagicSquareHowToPlayDialog
          open={open}
          onClose={onClose}
          onOpenTutorial={onOpenTutorial}
        />
      )}
      renderTutorial={({ open, onClose }) => (
        <MagicSquareTutorial open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <MagicSquareResultScreen
          difficulty={difficulty}
          result={clearedResult}
          recordFeedback={recordFeedback}
          onReplay={onReplay}
          onStartNewProblem={onStartNewProblem}
          onOpenGameHome={onOpenGameHome}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      )}
    >
      <main className="flex min-h-0 flex-1 px-2 py-2">
        <MagicSquareBoard
          givens={givens}
          board={board}
          memos={board.memos}
          lineEvaluations={lineEvaluations}
          selectedCellIndex={selectedCellIndex}
          interactionDisabled={!playing}
          clearing={progress === "clearing"}
          rejection={rejection.cell}
          onSelectCell={onSelectCell}
          onClearAnimationComplete={onClearAnimationComplete}
        />
      </main>
      <footer className="mx-auto w-full max-w-xl shrink-0 px-2 pb-2">
        <MagicSquareNumberPad
          size={board.size}
          valueStates={valueStates}
          memoInput={inputMode === "memo"}
          interactionDisabled={!playing}
          rejection={rejection.value}
          onEnterValue={onEnterValue}
          trailingActions={[
            <UndoButton key="undo" disabled={!canUndo} onUndo={onUndo} />,
            <MagicSquareMemoToggle
              key="memo"
              active={inputMode === "memo"}
              disabled={!playing}
              onToggle={onToggleMemoInput}
            />,
          ]}
        />
      </footer>
    </GamePlayFrame>
  );
}
