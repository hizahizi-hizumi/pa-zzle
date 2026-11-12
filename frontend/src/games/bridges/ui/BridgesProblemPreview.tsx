import type { BridgesProblem } from "@/games/bridges/problem/problem";
import { listBridgesIslandStatuses } from "@/games/bridges/puzzle/rules";
import { createInitialBridgesState } from "@/games/bridges/puzzle/state";
import { BridgesBoard } from "@/games/bridges/ui/board/BridgesBoard";

type BridgesProblemPreviewProps = {
  problem: BridgesProblem;
};

function ignoreBoardOperation() {}

/**
 * 1問の、始めたときの盤面。プレイ画面と同じ盤面を、置かれた枠に収まる最大の正方形で中央に描く。操作は受けない。
 * 海は地が描くので、プレイ画面と同じく盤面の絵には海を描かない。
 */
export function BridgesProblemPreview({ problem }: BridgesProblemPreviewProps) {
  const initialState = createInitialBridgesState(problem);
  return (
    <div
      data-play-entry-board=""
      className="relative aspect-square w-[min(100cqw,100cqh)]"
    >
      <BridgesBoard
        board={problem}
        bridges={initialState.bridges}
        islandStatuses={listBridgesIslandStatuses(problem, initialState)}
        edgeNotice={null}
        clearing={false}
        interactionDisabled
        onCycleEdge={ignoreBoardOperation}
        onClearAnimationComplete={ignoreBoardOperation}
      />
    </div>
  );
}
