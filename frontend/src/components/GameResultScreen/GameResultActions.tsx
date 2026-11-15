import { CircleArrowRight, Grid2X2, House, RotateCcw } from "lucide-react";
import "@/components/GameResultScreen/GameResultActions.css";

import { withPlayStartSound } from "@/components/app-decision-sound";
import { Button } from "@/components/ui/button";
import { Link } from "@/router";

type GameResultActionsProps = {
  onStartNewProblem: () => void;
  onOpenGameHome: () => void;
  onReplay?: () => void;
};

export function GameResultActions({
  onStartNewProblem,
  onOpenGameHome,
  onReplay,
}: GameResultActionsProps) {
  return (
    <nav className="result-actions--quiet" aria-label="結果からの操作">
      <Button
        type="button"
        variant="result-action-primary"
        size="result"
        onClick={withPlayStartSound(onStartNewProblem)}
      >
        <CircleArrowRight aria-hidden="true" />
        <span>次の問題</span>
      </Button>
      <Button
        type="button"
        variant="result-action"
        size="result"
        onClick={onOpenGameHome}
      >
        <Grid2X2 aria-hidden="true" />
        <span>問題選択</span>
      </Button>
      <Button
        type="button"
        variant="result-action"
        size="result"
        disabled={!onReplay}
        onClick={onReplay && withPlayStartSound(onReplay)}
      >
        <RotateCcw aria-hidden="true" />
        <span>もう一度</span>
      </Button>
      <Button asChild variant="result-action" size="result">
        <Link to="/">
          <House aria-hidden="true" />
          <span>パズル選択</span>
        </Link>
      </Button>
    </nav>
  );
}
