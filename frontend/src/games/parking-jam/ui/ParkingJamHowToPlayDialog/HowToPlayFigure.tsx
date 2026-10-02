import type { ParkingJamVehicleId } from "@/games/parking-jam/puzzle/board";
import { ParkingJamBoardFigure } from "@/games/parking-jam/ui/board/ParkingJamBoardFigure";
import {
  type ParkingJamBoardNotation,
  parseParkingJamBoardNotation,
} from "@/games/parking-jam/ui/board/parking-jam-board-notation";

type HowToPlayFigureProps = ParkingJamBoardNotation & {
  /** 選んだときの縁取りと出庫方向の矢印を付ける車の文字。 */
  selectedVehicleId?: ParkingJamVehicleId;
};

/** 盤面と同じ見た目で描く、遊び方の小さな駐車場。 */
export function HowToPlayFigure({
  rows,
  roadOpenings,
  selectedVehicleId,
}: HowToPlayFigureProps) {
  return (
    <span aria-hidden="true" className="flex h-14 shrink-0">
      <ParkingJamBoardFigure
        board={parseParkingJamBoardNotation({ rows, roadOpenings })}
        selectedVehicleId={selectedVehicleId}
      />
    </span>
  );
}
