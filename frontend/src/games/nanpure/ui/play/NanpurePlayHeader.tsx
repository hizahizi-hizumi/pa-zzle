import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PlayHeaderSummary } from "@/games/nanpure/ui/play/NanpurePlayHeader/PlayHeaderSummary";
import { PlayMenu } from "@/games/nanpure/ui/play/NanpurePlayHeader/PlayMenu";

type NanpurePlayHeaderProps = {
  elapsedMs: number;
  mistakeCount: number;
  undoCount: number;
  onRestart: () => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function NanpurePlayHeader({
  elapsedMs,
  mistakeCount,
  undoCount,
  onRestart,
  onReplay,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: NanpurePlayHeaderProps) {
  return (
    <header className="grid h-[4.5rem] shrink-0 grid-cols-[3rem_minmax(0,1fr)_3rem] items-start bg-background px-3 pt-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="難易度選択へ戻る"
        onClick={onChangeDifficulty}
      >
        <ArrowLeft />
      </Button>
      <PlayHeaderSummary
        elapsedMs={elapsedMs}
        mistakeCount={mistakeCount}
        undoCount={undoCount}
      />
      <PlayMenu
        onRestart={onRestart}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenDiagnostics={onOpenDiagnostics}
      />
    </header>
  );
}
