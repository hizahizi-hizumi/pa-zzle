import { CircleArrowRight, Grid2X2, House, RotateCcw } from "lucide-react";
import "@/components/GameResultScreen/GameResultActions.css";

import { withPlayStartSound } from "@/components/app-decision-sound";
import { Link } from "@/router";

type GameResultActionsProps = {
  onStartNewProblem: () => void;
  onOpenGameHome: () => void;
  /** 省略すると「もう一度」を押せない状態で出す。 */
  onReplay?: () => void;
};

export function GameResultActions({
  onStartNewProblem,
  onOpenGameHome,
  onReplay,
}: GameResultActionsProps) {
  return (
    <nav className="result-actions--quiet" aria-label="結果からの操作">
      <button
        type="button"
        className="result-action result-action--primary"
        onClick={withPlayStartSound(onStartNewProblem)}
      >
        <CircleArrowRight aria-hidden="true" />
        <span>次の問題</span>
      </button>
      <button
        type="button"
        className="result-action"
        data-result-collection=""
        onClick={onOpenGameHome}
      >
        <Grid2X2 aria-hidden="true" />
        <span>問題選択</span>
      </button>
      <button
        type="button"
        className="result-action"
        disabled={!onReplay}
        onClick={onReplay && withPlayStartSound(onReplay)}
      >
        <RotateCcw aria-hidden="true" />
        <span>もう一度</span>
      </button>
      <Link to="/" className="result-action">
        <House aria-hidden="true" />
        <span>パズル選択</span>
      </Link>
    </nav>
  );
}
