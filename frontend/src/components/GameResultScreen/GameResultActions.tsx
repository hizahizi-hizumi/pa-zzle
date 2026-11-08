import { Grid2x2, Home, Play, RotateCcw } from "lucide-react";

import { withPlayStartSound } from "@/components/app-decision-sound";
import { Button } from "@/components/ui/button";
import { Link } from "@/router";

type GameResultActionsProps = {
  onStartNewProblem: () => void;
  nextProblemLabel?: string;
  onOpenGameHome: () => void;
  /** 省略すると「もう一度」を押せない状態で出す。 */
  onReplay?: () => void;
};

/**
 * 結果を受け取ったあとの次の行動。次の問題を主とし、ゲームのホームへ移る・同じ問題をもう一度遊ぶを従として縦に並べる。
 * 最後に、ほかのパズルを選びに戻るパズル選択（アプリのホーム）を、従よりさらに弱く置く。
 * アイコンはプレイ中のメニューの同じ行き先（ゲームのホーム・ホーム）とそろえる。
 */
export function GameResultActions({
  onStartNewProblem,
  nextProblemLabel = "次の問題",
  onOpenGameHome,
  onReplay,
}: GameResultActionsProps) {
  return (
    <div className="mt-4 grid gap-2">
      <Button size="lg" onClick={withPlayStartSound(onStartNewProblem)}>
        <Play />
        {nextProblemLabel}
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
