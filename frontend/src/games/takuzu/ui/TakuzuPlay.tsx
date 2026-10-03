import { type ReactNode, useState } from "react";

import { BrandIdentityHeader } from "@/components/BrandIdentityHeader";
import { PlayHeader } from "@/components/PlayHeader";
import { UndoButton } from "@/components/UndoButton";
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
import { TakuzuResultScreen } from "@/games/takuzu/ui/result/TakuzuResultScreen";
import { TakuzuHowToPlayDialog } from "@/games/takuzu/ui/TakuzuHowToPlayDialog";
import { TakuzuTutorial } from "@/games/takuzu/ui/TakuzuTutorial";
import { formatElapsedTime } from "@/lib/format-elapsed-time";

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
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

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
      {/* 置き直しと待ったは2桁分の幅を取っておき、10回目で計測値の並びが横へ動かないようにする。 */}
      <PlayHeader
        title="バイナリパズル"
        metricGroups={[
          [
            {
              label: "置き直し",
              value: String(correctionCount),
              reservedDigits: 2,
            },
            { label: "時間", value: formatElapsedTime(elapsedMs) },
          ],
          [{ label: "待った", value: String(undoCount), reservedDigits: 2 }],
        ]}
        onRestart={onRestart}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenHowToPlay={() => setHowToPlayOpen(true)}
        onOpenTutorial={() => setTutorialOpen(true)}
        onOpenDiagnostics={onOpenDiagnostics}
      />
      <TakuzuHowToPlayDialog
        open={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
      />
      <TakuzuTutorial
        open={tutorialOpen}
        origin="play"
        onClose={() => setTutorialOpen(false)}
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
