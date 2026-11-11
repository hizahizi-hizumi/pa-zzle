import type { ParkingJamProblem } from "@/games/parking-jam/problem/problem";
import { createParkingJamInitialState } from "@/games/parking-jam/puzzle/board";
import { ParkingJamBoard } from "@/games/parking-jam/ui/board/ParkingJamBoard";

type ParkingJamProblemPreviewProps = {
  problem: ParkingJamProblem;
};

function ignoreBoardOperation() {}

/**
 * 1問の、始めたときの盤面。プレイ画面と同じ盤面（道路の余白も同じ）を、縦横比を保って置かれた枠に収める。操作は受けない。
 * 遊び方の図（`ParkingJamBoardFigure`）は余白を詰めていて、プレイ画面の盤面へ広がるときに姿が変わるので使わない。
 */
export function ParkingJamProblemPreview({
  problem,
}: ParkingJamProblemPreviewProps) {
  return (
    <ParkingJamBoard
      board={problem.board}
      state={createParkingJamInitialState(problem.board)}
      selectedVehicleId={null}
      operation={null}
      interactionDisabled
      clearing={false}
      onSelectVehicle={ignoreBoardOperation}
      onMove={ignoreBoardOperation}
      onClearAnimationComplete={ignoreBoardOperation}
    />
  );
}
