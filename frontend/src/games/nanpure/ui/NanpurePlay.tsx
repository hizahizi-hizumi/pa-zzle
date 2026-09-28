import type { ReactNode } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import type {
  NanpureProgress,
  NanpureResult,
} from "@/games/nanpure/play/use-nanpure-play";
import type {
  NanpureBoard as NanpureBoardState,
  NanpureDigit,
} from "@/games/nanpure/puzzle/board";
import type { NanpureNotes } from "@/games/nanpure/session/session";
import { NanpureClearAnimation } from "@/games/nanpure/ui/board/clear/NanpureClearAnimation";
import { NanpureBoard } from "@/games/nanpure/ui/board/NanpureBoard";
import { NanpureInputPanel } from "@/games/nanpure/ui/play/NanpureInputPanel";
import { NanpurePlayHeader } from "@/games/nanpure/ui/play/NanpurePlayHeader";
import { NanpureResultScreen } from "@/games/nanpure/ui/result/NanpureResultScreen";

type NanpurePlayProps = {
  difficulty: NanpureDifficulty;
  status: "playing" | "cleared";
  progress: NanpureProgress;
  clues: NanpureBoardState;
  board: NanpureBoardState;
  notes: NanpureNotes;
  selectedCellIndex: number | null;
  conflictCellIndices: readonly number[];
  mistakeCellIndices: readonly number[];
  completedDigits: readonly NanpureDigit[];
  notesMode: boolean;
  elapsedMs: number;
  mistakeCount: number;
  undoCount: number;
  canUndo: boolean;
  result: NanpureResult | null;
  recordOutcomeNotice: ReactNode;
  onSelectCell: (cellIndex: number) => void;
  onInputDigit: (digit: NanpureDigit) => void;
  onErase: () => void;
  onToggleNotesMode: () => void;
  onUndo: () => void;
  onRestart: () => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onClearAnimationComplete: () => void;
  onOpenDiagnostics?: () => void;
};

export function NanpurePlay({
  difficulty,
  status,
  progress,
  clues,
  board,
  notes,
  selectedCellIndex,
  conflictCellIndices,
  mistakeCellIndices,
  completedDigits,
  notesMode,
  elapsedMs,
  mistakeCount,
  undoCount,
  canUndo,
  result,
  recordOutcomeNotice,
  onSelectCell,
  onInputDigit,
  onErase,
  onToggleNotesMode,
  onUndo,
  onRestart,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onClearAnimationComplete,
  onOpenDiagnostics,
}: NanpurePlayProps) {
  if (progress === "result" && status === "cleared" && result) {
    return (
      <NanpureResultScreen
        difficulty={difficulty}
        result={result}
        recordOutcomeNotice={recordOutcomeNotice}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onOpenRecords={onOpenRecords}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenDiagnostics={onOpenDiagnostics}
      />
    );
  }

  const interactionEnabled = status === "playing" && progress === "playing";
  const selectedIsEditable =
    selectedCellIndex !== null && clues[selectedCellIndex] === null;
  const selectedHasAnswer =
    selectedCellIndex !== null && board[selectedCellIndex] !== null;
  const selectedHasNotes =
    selectedCellIndex !== null && (notes[selectedCellIndex]?.length ?? 0) > 0;

  return (
    <section className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
      <NanpurePlayHeader
        elapsedMs={elapsedMs}
        mistakeCount={mistakeCount}
        undoCount={undoCount}
        onRestart={onRestart}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenDiagnostics={onOpenDiagnostics}
      />

      <main className="flex shrink-0 justify-center px-2 pt-1 sm:px-6 sm:pt-3">
        <NanpureClearAnimation
          active={progress === "clearing"}
          onComplete={onClearAnimationComplete}
        >
          <NanpureBoard
            board={board}
            clues={clues}
            notes={notes}
            selectedCellIndex={selectedCellIndex}
            conflictCellIndices={conflictCellIndices}
            mistakeCellIndices={mistakeCellIndices}
            interactionDisabled={!interactionEnabled}
            onSelectCell={onSelectCell}
          />
        </NanpureClearAnimation>
      </main>

      <NanpureInputPanel
        notesMode={notesMode}
        interactionEnabled={interactionEnabled}
        selectedIsEditable={selectedIsEditable}
        selectedHasAnswer={selectedHasAnswer}
        selectedHasNotes={selectedHasNotes}
        completedDigits={completedDigits}
        canUndo={canUndo}
        onUndo={onUndo}
        onErase={onErase}
        onToggleNotesMode={onToggleNotesMode}
        onInputDigit={onInputDigit}
      />
    </section>
  );
}
