import { type ReactNode, useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { PlayHeader } from "@/components/PlayHeader";
import { UndoButton } from "@/components/UndoButton";
import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import type {
  WaterSortOperation,
  WaterSortProgress,
  WaterSortResult,
} from "@/games/water-sort/play/use-water-sort-play";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import { WaterSortBoard } from "@/games/water-sort/ui/board/WaterSortBoard";
import { WaterSortHowToPlayDialog } from "@/games/water-sort/ui/WaterSortHowToPlayDialog";
import { DeadlockNotice } from "@/games/water-sort/ui/WaterSortPlay/DeadlockNotice";
import { WaterSortResultScreen } from "@/games/water-sort/ui/WaterSortPlay/WaterSortResultScreen";
import { formatElapsedTime } from "@/lib/format-elapsed-time";

type WaterSortPlayProps = {
  difficulty: WaterSortDifficulty;
  status: "playing" | "cleared";
  progress: WaterSortProgress;
  state: WaterSortState;
  elapsedMs: number;
  moveCount: number;
  undoCount: number;
  canUndo: boolean;
  isDeadlocked: boolean;
  sourceBottleIndex: number | null;
  operation: WaterSortOperation | null;
  result: WaterSortResult | null;
  recordOutcomeNotice: ReactNode;
  onSelectBottle: (bottleIndex: number) => void;
  onUndo: () => void;
  onRestart: () => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onClearingPourComplete: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function WaterSortPlay({
  difficulty,
  status,
  progress,
  state,
  elapsedMs,
  moveCount,
  undoCount,
  canUndo,
  isDeadlocked,
  sourceBottleIndex,
  operation,
  result,
  recordOutcomeNotice,
  onSelectBottle,
  onUndo,
  onRestart,
  onReplay,
  onStartNewProblem,
  onOpenRecords,
  onClearingPourComplete,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: WaterSortPlayProps) {
  const [hasActivePourAnimation, setHasActivePourAnimation] = useState(false);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const showDeadlockNotice = isDeadlocked && !hasActivePourAnimation;

  if (progress === "result" && status === "cleared" && result) {
    return (
      <WaterSortResultScreen
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

  return (
    <section className="fixed inset-0 z-(--layer-overlay) flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
      <PlayHeader
        title="ウォーターソート"
        metricGroups={[
          [
            { label: "手数", value: String(moveCount) },
            { label: "時間", value: formatElapsedTime(elapsedMs) },
            { label: "待った", value: String(undoCount) },
          ],
        ]}
        onRestart={onRestart}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenHowToPlay={() => setHowToPlayOpen(true)}
        onOpenDiagnostics={onOpenDiagnostics}
      />
      <WaterSortHowToPlayDialog
        open={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
      />
      <main className="flex min-h-0 flex-1 items-center justify-center px-3 py-2 sm:px-6">
        <WaterSortBoard
          state={state}
          sourceBottleIndex={sourceBottleIndex}
          operation={operation}
          onSelectBottle={onSelectBottle}
          interactionDisabled={progress !== "playing"}
          onPourAnimationActivityChange={setHasActivePourAnimation}
          onClearingPourComplete={onClearingPourComplete}
        />
      </main>
      <footer className="grid h-28 shrink-0 items-end px-4 pb-2">
        {showDeadlockNotice ? (
          <DeadlockNotice
            canUndo={canUndo}
            onUndo={onUndo}
            onRestart={onRestart}
          />
        ) : (
          <div className="flex h-14 items-center justify-center">
            <UndoButton disabled={!canUndo} onUndo={onUndo} />
          </div>
        )}
      </footer>
    </section>
  );
}
