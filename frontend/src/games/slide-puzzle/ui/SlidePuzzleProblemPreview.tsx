import type { SlidePuzzleProblem } from "@/games/slide-puzzle/problem/problem";
import { SlidePuzzleBoard } from "@/games/slide-puzzle/ui/board/SlidePuzzleBoard";

type SlidePuzzleProblemPreviewProps = {
  problem: SlidePuzzleProblem;
};

function ignoreBoardOperation() {}

/** 1問の、始めたときの盤面。プレイ画面と同じ盤面を、置かれた枠に収まる正方形で描く。操作は受けない。 */
export function SlidePuzzleProblemPreview({
  problem,
}: SlidePuzzleProblemPreviewProps) {
  return (
    <div className="aspect-square w-[min(100cqw,100cqh)]">
      <SlidePuzzleBoard
        board={problem.initialBoard}
        operation={null}
        interactionDisabled
        clearing={false}
        onSlideTile={ignoreBoardOperation}
        onClearAnimationComplete={ignoreBoardOperation}
      />
    </div>
  );
}
