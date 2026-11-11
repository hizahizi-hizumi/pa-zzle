import type { TakuzuProblem } from "@/games/takuzu/problem/problem";
import {
  createTakuzuSession,
  getTakuzuSessionCellViews,
  getTakuzuSessionLineViolations,
} from "@/games/takuzu/session/session";
import { TakuzuBoard } from "@/games/takuzu/ui/board/TakuzuBoard";

type TakuzuProblemPreviewProps = {
  problem: TakuzuProblem;
};

function ignoreBoardOperation() {}

/** 1問の、始めたときの盤面。プレイ画面と同じ盤面を、置かれた枠に収まる正方形で描く。操作は受けない。 */
export function TakuzuProblemPreview({ problem }: TakuzuProblemPreviewProps) {
  // 始めたときのマスの見え方を、プレイと同じ手順で作る。開始時刻は見え方に関わらない。
  const session = createTakuzuSession(problem, 0);
  return (
    <div className="aspect-square w-[min(100cqw,100cqh)]">
      <TakuzuBoard
        size={problem.givens.size}
        cells={getTakuzuSessionCellViews(session)}
        lineViolations={getTakuzuSessionLineViolations(session)}
        operation={null}
        interactionDisabled
        onCycleCell={ignoreBoardOperation}
        onPlaceCell={ignoreBoardOperation}
      />
    </div>
  );
}
