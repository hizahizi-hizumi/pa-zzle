import { Undo2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { Button } from "@/components/ui/button";
import type { WaterSortDifficulty } from "@/games/water-sort/difficulty";
import type {
  WaterSortOperation,
  WaterSortProgress,
  WaterSortResult,
} from "@/games/water-sort/play/use-water-sort-play";
import type { WaterSortState } from "@/games/water-sort/puzzle/state";
import { WaterSortBoard } from "@/games/water-sort/ui/board/WaterSortBoard";
import { DeadlockNotice } from "@/games/water-sort/ui/WaterSortPlay/DeadlockNotice";
import { WaterSortPlayHeader } from "@/games/water-sort/ui/WaterSortPlay/WaterSortPlayHeader";
import { WaterSortResultScreen } from "@/games/water-sort/ui/WaterSortPlay/WaterSortResultScreen";

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
    <section className="fixed inset-0 z-50 flex min-h-svh flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom)]">
      <BrandIdentityHeader />
      <WaterSortPlayHeader
        elapsedMs={elapsedMs}
        moveCount={moveCount}
        undoCount={undoCount}
        onRestart={onRestart}
        onStartNewProblem={onStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenDiagnostics={onOpenDiagnostics}
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
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="size-12 rounded-full border bg-background shadow-sm"
              aria-label="待った"
              onClick={onUndo}
              disabled={!canUndo}
            >
              <Undo2 className="size-5" />
            </Button>
          </div>
        )}
      </footer>
    </section>
  );
}
