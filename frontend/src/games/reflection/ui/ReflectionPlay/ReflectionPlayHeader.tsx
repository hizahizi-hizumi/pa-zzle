import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PlayHeaderSummary } from "@/games/reflection/ui/ReflectionPlay/ReflectionPlayHeader/PlayHeaderSummary";
import { PlayMenu } from "@/games/reflection/ui/ReflectionPlay/ReflectionPlayHeader/PlayMenu";

type ReflectionPlayHeaderProps = {
  relocationCount: number;
  elapsedMs: number;
  undoCount: number;
  canRestart: boolean;
  onRestart: () => void;
  onReplay: () => void;
  onStartNewProblem: () => void;
  onChangeDifficulty?: () => void;
  onBackToHome: () => void;
  onOpenHowToPlay: () => void;
};

export function ReflectionPlayHeader({
  relocationCount,
  elapsedMs,
  undoCount,
  canRestart,
  onRestart,
  onReplay,
  onStartNewProblem,
  onChangeDifficulty,
  onBackToHome,
  onOpenHowToPlay,
}: ReflectionPlayHeaderProps) {
  return (
    <header className="grid h-[4.5rem] shrink-0 grid-cols-[3rem_minmax(0,1fr)_3rem] items-start bg-background px-3 pt-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label={onChangeDifficulty ? "難易度選択へ戻る" : "ホームへ戻る"}
        onClick={onChangeDifficulty ?? onBackToHome}
      >
        <ArrowLeft />
      </Button>
      <PlayHeaderSummary
        relocationCount={relocationCount}
        elapsedMs={elapsedMs}
        undoCount={undoCount}
      />
      <PlayMenu
        canRestart={canRestart}
        onRestart={onRestart}
        onReplay={onReplay}
        onStartNewProblem={onStartNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenHowToPlay={onOpenHowToPlay}
      />
    </header>
  );
}
