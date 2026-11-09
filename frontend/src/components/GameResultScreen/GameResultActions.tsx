import { ArrowRight, Grid2x2, Home, Play, RotateCcw } from "lucide-react";
import "@/components/GameResultScreen/GameResultActions.css";

import { withPlayStartSound } from "@/components/app-decision-sound";
import { Button } from "@/components/ui/button";
import { Link } from "@/router";

type GameResultActionsProps = {
  onStartNewProblem: () => void;
  onOpenGameHome: () => void;
  /** 省略すると「もう一度」を押せない状態で出す。 */
  onReplay?: () => void;
  variant?: "standard" | "quiet";
};

/** 結果から進む主操作と、遊び方を変える副操作。 */
export function GameResultActions({
  onStartNewProblem,
  onOpenGameHome,
  onReplay,
  variant = "standard",
}: GameResultActionsProps) {
  if (variant === "quiet") {
    return (
      <nav className="result-actions--quiet" aria-label="結果からの操作">
        <Button
          size="lg"
          variant="ghost"
          onClick={withPlayStartSound(onStartNewProblem)}
        >
          次の問題
          <ArrowRight className="size-5" />
        </Button>
        <div className="result-actions--quiet-secondary">
          <Button variant="ghost" onClick={onOpenGameHome}>
            問題選択
          </Button>
          <Button
            variant="ghost"
            disabled={!onReplay}
            onClick={onReplay && withPlayStartSound(onReplay)}
          >
            もう一度
          </Button>
          <Button asChild variant="ghost">
            <Link to="/">パズル選択</Link>
          </Button>
        </div>
      </nav>
    );
  }

  return (
    <div className="mt-4 grid gap-2">
      <Button size="lg" onClick={withPlayStartSound(onStartNewProblem)}>
        <Play />
        次の問題
      </Button>
      <Button size="lg" variant="outline" onClick={onOpenGameHome}>
        <Grid2x2 />
        問題選択
      </Button>
      <Button
        size="lg"
        variant="outline"
        disabled={!onReplay}
        onClick={onReplay && withPlayStartSound(onReplay)}
      >
        <RotateCcw />
        もう一度
      </Button>
      <Button asChild size="lg" variant="ghost">
        <Link to="/">
          <Home />
          パズル選択
        </Link>
      </Button>
    </div>
  );
}
