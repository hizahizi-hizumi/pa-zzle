import type { IceFloorMazeProblem } from "@/games/ice-floor-maze/problem/problem";
import { createIceFloorMazeInitialState } from "@/games/ice-floor-maze/puzzle/state";
import { IceFloorMazeBoard } from "@/games/ice-floor-maze/ui/board/IceFloorMazeBoard";

type IceFloorMazeProblemPreviewProps = {
  problem: IceFloorMazeProblem;
};

function ignoreBoardEvent() {}

/** 1問の、始めたときの盤面。プレイ画面と同じ盤面を、置かれた枠に収まる大きさで中央に描く。操作は受けない。 */
export function IceFloorMazeProblemPreview({
  problem,
}: IceFloorMazeProblemPreviewProps) {
  const { board, start, goal } = problem;
  const { cells, blocks, position } = createIceFloorMazeInitialState(
    board,
    start,
  );
  return (
    <IceFloorMazeBoard
      board={board}
      cells={cells}
      blocks={blocks}
      goal={goal}
      position={position}
      lastSlide={null}
      blockedInput={null}
      clearing={false}
      onSlideAnimationActivityChange={ignoreBoardEvent}
      onClearAnimationComplete={ignoreBoardEvent}
    />
  );
}
