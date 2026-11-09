import { useState } from "react";
import { GamePlayFrame } from "@/components/GamePlayFrame";
import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import { NANPURE_DISPLAY_NAME } from "@/games/nanpure/display-name";
import type {
  NanpureOperation,
  NanpureResult,
} from "@/games/nanpure/play/use-nanpure-play";
import type {
  NanpureBoard as NanpureBoardState,
  NanpureDigit,
} from "@/games/nanpure/puzzle/board";
import type { NanpureNotes } from "@/games/nanpure/session/session";
import { NanpureClearAnimation } from "@/games/nanpure/ui/board/clear/NanpureClearAnimation";
import { NanpureBoard } from "@/games/nanpure/ui/board/NanpureBoard";
import { NanpureHowToPlayDialog } from "@/games/nanpure/ui/NanpureHowToPlayDialog";
import { NanpureExperienceSwitcher } from "@/games/nanpure/ui/NanpurePlay/NanpureExperienceSwitcher";
import { useNanpureSoundEffects } from "@/games/nanpure/ui/NanpurePlay/use-nanpure-sound-effects";
import type { NanpureExperienceVariant } from "@/games/nanpure/ui/nanpure-experience-variant";
import { NanpureInputPanel } from "@/games/nanpure/ui/play/NanpureInputPanel";
import { NanpureResultScreen } from "@/games/nanpure/ui/result/NanpureResultScreen";
import type {
  GamePlayScreenProps,
  RestartableGamePlayScreenProps,
  UndoableGamePlayScreenProps,
} from "@/games/play";
import { PLAY_OPERATION_LABELS } from "@/games/play-vocabulary";

type NanpurePlayProps = GamePlayScreenProps<NanpureDifficulty, NanpureResult> &
  RestartableGamePlayScreenProps &
  UndoableGamePlayScreenProps & {
    compareExperiences?: boolean;
    clues: NanpureBoardState;
    board: NanpureBoardState;
    notes: NanpureNotes;
    selectedCellIndex: number | null;
    conflictCellIndices: readonly number[];
    mistakeCellIndices: readonly number[];
    completedDigits: readonly NanpureDigit[];
    notesMode: boolean;
    operation: NanpureOperation | null;
    mistakeCount: number;
    undoCount: number;
    onSelectCell: (cellIndex: number) => void;
    onInputDigit: (digit: NanpureDigit) => void;
    onInputDigitAt?: (cellIndex: number, digit: NanpureDigit) => void;
    onErase: () => void;
    onToggleNotesMode: () => void;
  };

export function NanpurePlay({
  difficulty,
  progress,
  elapsedMs,
  result,
  recordFeedback,
  clues,
  compareExperiences = false,
  board,
  notes,
  selectedCellIndex,
  conflictCellIndices,
  mistakeCellIndices,
  completedDigits,
  notesMode,
  operation,
  mistakeCount,
  undoCount,
  canUndo,
  onSelectCell,
  onInputDigit,
  onInputDigitAt,
  onErase,
  onToggleNotesMode,
  onUndo,
  canRestart,
  onRestart,
  onReplay,
  onStartNewProblem,
  onOpenGameHome,
  onBackToHome,
  onClearAnimationComplete,
  onOpenDiagnostics,
}: NanpurePlayProps) {
  useNanpureSoundEffects(operation, progress);
  const [experience, setExperience] =
    useState<NanpureExperienceVariant>("classic");
  const [selectedDigit, setSelectedDigit] = useState<NanpureDigit | null>(null);

  const digitFirst = experience === "paint";
  const activeDigit =
    selectedDigit !== null && !completedDigits.includes(selectedDigit)
      ? selectedDigit
      : null;

  function handleExperienceChange(next: NanpureExperienceVariant) {
    setExperience(next);
    setSelectedDigit(null);
  }

  function handleDigitInput(digit: NanpureDigit) {
    if (digitFirst) {
      setSelectedDigit((current) => (current === digit ? null : digit));
      return;
    }
    onInputDigit(digit);
  }

  function handleSelectCell(cellIndex: number) {
    if (digitFirst && activeDigit !== null) {
      if (clues[cellIndex] !== null) return;
      if (board[cellIndex] !== null) {
        setSelectedDigit(null);
        onSelectCell(cellIndex);
        return;
      }
      onInputDigitAt?.(cellIndex, activeDigit);
      return;
    }
    onSelectCell(cellIndex);
  }

  const interactionEnabled = progress === "playing";
  const selectedIsEditable =
    selectedCellIndex !== null && clues[selectedCellIndex] === null;
  const selectedHasAnswer =
    selectedCellIndex !== null && board[selectedCellIndex] !== null;
  const selectedHasNotes =
    selectedCellIndex !== null && (notes[selectedCellIndex]?.length ?? 0) > 0;

  return (
    <GamePlayFrame
      progress={progress}
      result={result}
      title={NANPURE_DISPLAY_NAME}
      background={<div className="size-full bg-[#eae3ef] dark:bg-[#28251f]" />}
      metrics={[
        { type: "count", label: "ミス", count: mistakeCount },
        { type: "elapsed-time", elapsedMs },
        { type: "count", label: PLAY_OPERATION_LABELS.undo, count: undoCount },
      ]}
      canRestart={canRestart}
      onRestart={onRestart}
      onReplay={onReplay}
      onStartNewProblem={onStartNewProblem}
      onOpenGameHome={onOpenGameHome}
      onBackToHome={onBackToHome}
      onOpenDiagnostics={onOpenDiagnostics}
      renderHowToPlayDialog={({ open, onClose }) => (
        <NanpureHowToPlayDialog open={open} onClose={onClose} />
      )}
      renderResultScreen={(clearedResult) => (
        <NanpureResultScreen
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
      {compareExperiences && (
        <NanpureExperienceSwitcher
          value={experience}
          onChange={handleExperienceChange}
        />
      )}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:items-center lg:justify-center lg:gap-8">
        <main className="flex shrink-0 justify-center px-2 pt-1 sm:px-6 sm:pt-3 lg:px-0 lg:pt-0">
          <NanpureClearAnimation
            active={progress === "clearing"}
            onComplete={onClearAnimationComplete}
          >
            <NanpureBoard
              board={board}
              clues={clues}
              notes={notes}
              selectedCellIndex={
                digitFirst && activeDigit !== null ? null : selectedCellIndex
              }
              highlightDigit={digitFirst ? activeDigit : null}
              conflictCellIndices={conflictCellIndices}
              mistakeCellIndices={mistakeCellIndices}
              interactionDisabled={!interactionEnabled}
              onSelectCell={handleSelectCell}
            />
          </NanpureClearAnimation>
        </main>

        <NanpureInputPanel
          notesMode={notesMode}
          digitFirst={digitFirst}
          selectedDigit={activeDigit}
          interactionEnabled={interactionEnabled}
          selectedIsEditable={selectedIsEditable}
          selectedHasAnswer={selectedHasAnswer}
          selectedHasNotes={selectedHasNotes}
          completedDigits={completedDigits}
          canUndo={canUndo}
          onUndo={onUndo}
          onErase={onErase}
          onToggleNotesMode={onToggleNotesMode}
          onInputDigit={handleDigitInput}
        />
      </div>
    </GamePlayFrame>
  );
}
