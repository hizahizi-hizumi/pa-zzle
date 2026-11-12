import type { HitofudePuzzleProblem } from "@/games/hitofude-puzzle/problem/problem";
import { createInitialHitofudePuzzleState } from "@/games/hitofude-puzzle/puzzle/state";
import { HitofudePuzzleFigure } from "@/games/hitofude-puzzle/ui/board/HitofudePuzzleFigure";

type HitofudePuzzleProblemPreviewProps = {
  problem: HitofudePuzzleProblem;
};

/**
 * 1問の、始めたときの盤面。プレイ画面の盤面の見た目を描く絵だけを、置かれた枠に収まる正方形で描く。
 * 盤面のマスのボタンは見た目を持たない操作の受け口なので、操作を受けないプレビューには置かない。
 */
export function HitofudePuzzleProblemPreview({
  problem,
}: HitofudePuzzleProblemPreviewProps) {
  return (
    <div className="relative aspect-square w-[min(100cqw,100cqh)]">
      <HitofudePuzzleFigure
        board={problem}
        path={createInitialHitofudePuzzleState(problem).path}
        isDeadEnd={false}
        solved={false}
      />
    </div>
  );
}
