import { Grid2x2, Home, Play, RotateCcw } from "lucide-react";

import { withPlayStartSound } from "@/components/app-decision-sound";
import { Button } from "@/components/ui/button";
import { Link } from "@/router";

type GameResultActionsProps = {
  onStartNewProblem: () => void;
  onOpenGameHome: () => void;
  /** 省略すると「もう一度」を押せない状態で出す。 */
  onReplay?: () => void;
};

/**
 * 結果を受け取ったあとの次の行動。次の問題だけを主として全幅に置き、結果を受け取った流れのまま進めるようにする。
 * ゲームのホームへ移る・同じ問題をもう一度遊ぶは同格の従として2列に並べ、
 * ほかのパズルを選びに戻るパズル選択（アプリのホーム）は、操作の並びから外したテキストリンクにする。
 * アイコンはプレイ中のメニューの同じ行き先（ゲームのホーム・ホーム）とそろえる。
 */
export function GameResultActions({
  onStartNewProblem,
  onOpenGameHome,
  onReplay,
}: GameResultActionsProps) {
  return (
    <div className="mt-6 grid gap-2">
      <Button size="lg" onClick={withPlayStartSound(onStartNewProblem)}>
        <Play />
        次の問題
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" variant="secondary" onClick={onOpenGameHome}>
          <Grid2x2 />
          問題選択
        </Button>
        <Button
          size="lg"
          variant="secondary"
          disabled={!onReplay}
          onClick={onReplay && withPlayStartSound(onReplay)}
        >
          <RotateCcw />
          もう一度
        </Button>
      </div>
      <div className="flex justify-center">
        <Button asChild size="lg" variant="link">
          <Link to="/">
            <Home />
            パズル選択
          </Link>
        </Button>
      </div>
    </div>
  );
}
