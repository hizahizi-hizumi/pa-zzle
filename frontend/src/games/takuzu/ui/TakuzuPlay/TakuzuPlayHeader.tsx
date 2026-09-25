import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TakuzuDifficulty } from "@/games/takuzu/difficulty";
import { PlayHeaderSummary } from "@/games/takuzu/ui/TakuzuPlay/TakuzuPlayHeader/PlayHeaderSummary";
import { PlayMenu } from "@/games/takuzu/ui/TakuzuPlay/TakuzuPlayHeader/PlayMenu";

type TakuzuPlayHeaderProps = {
  difficulty: TakuzuDifficulty;
  elapsedMs: number;
  onRestart: () => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenDiagnostics?: () => void;
};

export function TakuzuPlayHeader({
  difficulty,
  elapsedMs,
  onRestart,
  onReplay,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
  onOpenDiagnostics,
}: TakuzuPlayHeaderProps) {
  return (
    <header className="grid h-[4.5rem] shrink-0 grid-cols-[3rem_minmax(0,1fr)_3rem] items-start bg-background px-3 pt-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label="難易度選択へ戻る"
        onClick={onChangeDifficulty}
      >
        <ArrowLeft />
      </Button>
      <PlayHeaderSummary difficulty={difficulty} elapsedMs={elapsedMs} />
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
