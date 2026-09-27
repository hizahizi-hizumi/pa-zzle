import { type ReactNode, useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import type {
  TakuzuProgress,
  TakuzuResult,
} from "@/games/takuzu/play/use-takuzu-play";
import type { TakuzuCell } from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import type {
  TakuzuCellView,
  TakuzuLineViolationView,
} from "@/games/takuzu/session/session";
import { TakuzuClearAnimation } from "@/games/takuzu/ui/board/clear/TakuzuClearAnimation";
import { TakuzuBoard } from "@/games/takuzu/ui/board/TakuzuBoard";
import { readTakuzuHowToPlaySeen } from "@/games/takuzu/ui/how-to-play-seen";
import { TakuzuResultScreen } from "@/games/takuzu/ui/result/TakuzuResultScreen";
import { TakuzuHowToPlayDialog } from "@/games/takuzu/ui/TakuzuHowToPlayDialog";
import { TakuzuPlayHeader } from "@/games/takuzu/ui/TakuzuPlay/TakuzuPlayHeader";
import { UndoButton } from "@/games/takuzu/ui/TakuzuPlay/UndoButton";

type TakuzuPlayProps = {
  difficulty: TakuzuDifficulty;
  size: number;
  cells: readonly TakuzuCellView[];
  lineViolations: readonly TakuzuLineViolationView[];
  progress: TakuzuProgress;
  correctionCount: number;
  undoCount: number;
  canUndo: boolean;
  elapsedMs: number;
  result: TakuzuResult | null;
  recordOutcomeNotice: ReactNode;
  onCycleCell: (cellIndex: number, direction: TakuzuCycleDirection) => void;
  onPlaceCell: (cellIndex: number, cell: TakuzuCell) => void;
  onUndo: () => void;
  onRestart: () => void;
  onReplay: () => void;
  onClearAnimationComplete: () => void;
  onStartNewProblem: () => void;
  onOpenRecords: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function TakuzuPlay({
  difficulty,
  size,
  cells,
  lineViolations,
  progress,
  correctionCount,
  undoCount,
  canUndo,
  elapsedMs,
  result,
  recordOutcomeNotice,
  onCycleCell,
  onPlaceCell,
  onUndo,
  onRestart,
  onReplay,
  onClearAnimationComplete,
  onStartNewProblem,
  onOpenRecords,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: TakuzuPlayProps) {
  // 初めて遊ぶときだけ、盤面より先に遊び方を開く（intro）。
  const [howToPlay, setHowToPlay] = useState<"closed" | "intro" | "open">(() =>
    readTakuzuHowToPlaySeen() ? "closed" : "intro",
  );

  function closeHowToPlay() {
    // 初めての遊び方を読んでいた時間はプレイ時間に含めないよう、閉じたところから測り直す。
    if (howToPlay === "intro") {
      onReplay();
    }
    setHowToPlay("closed");
  }

  if (progress === "result" && result) {
    return (
      <TakuzuResultScreen
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
      <TakuzuPlayHeader
        correctionCount={correctionCount}
        elapsedMs={elapsedMs}
        undoCount={undoCount}
        onRestart={onRestart}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenHowToPlay={() => setHowToPlay("open")}
        onOpenDiagnostics={onOpenDiagnostics}
      />
      <TakuzuHowToPlayDialog
        open={howToPlay !== "closed"}
        onClose={closeHowToPlay}
      />
      <main className="flex min-h-0 flex-1 items-center justify-center py-2 [container-type:size] sm:px-3">
        <div className="relative aspect-square w-[min(100cqw,100cqh,42rem)]">
          <TakuzuClearAnimation
            active={progress === "clearing"}
            onComplete={onClearAnimationComplete}
          >
            <TakuzuBoard
              size={size}
              cells={cells}
              lineViolations={lineViolations}
              disabled={progress !== "playing"}
              onCycleCell={onCycleCell}
              onPlaceCell={onPlaceCell}
            />
          </TakuzuClearAnimation>
        </div>
      </main>
      <footer className="grid h-28 shrink-0 items-end px-4 pb-2">
        <div className="flex h-14 items-center justify-center">
          <UndoButton
            disabled={progress !== "playing" || !canUndo}
            onUndo={onUndo}
          />
        </div>
      </footer>
    </section>
  );
}
