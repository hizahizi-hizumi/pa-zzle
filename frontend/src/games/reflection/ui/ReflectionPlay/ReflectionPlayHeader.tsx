import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PlayHeaderSummary } from "@/games/reflection/ui/ReflectionPlay/ReflectionPlayHeader/PlayHeaderSummary";
import { PlayMenu } from "@/games/reflection/ui/ReflectionPlay/ReflectionPlayHeader/PlayMenu";

type ReflectionPlayHeaderProps = {
  elapsedMs: number;
  canRestart: boolean;
  onRestart: () => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty: () => void;
  onBackToHome: () => void;
  onOpenHowToPlay: () => void;
  onOpenDiagnostics?: () => void;
};

export function ReflectionPlayHeader({
  elapsedMs,
  canRestart,
  onRestart,
  onReplay,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
  onOpenHowToPlay,
  onOpenDiagnostics,
}: ReflectionPlayHeaderProps) {
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
      <PlayHeaderSummary elapsedMs={elapsedMs} />
      <PlayMenu
        canRestart={canRestart}
        onRestart={onRestart}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenHowToPlay={onOpenHowToPlay}
        onOpenDiagnostics={onOpenDiagnostics}
      />
    </header>
  );
}
