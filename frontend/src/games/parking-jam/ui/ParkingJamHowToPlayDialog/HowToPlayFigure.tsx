import type { ParkingJamVehicleId } from "@/games/parking-jam/puzzle/board";
import { ParkingJamBoardFigure } from "@/games/parking-jam/ui/board/ParkingJamBoardFigure";
import {
  type ParkingJamBoardNotation,
  parseParkingJamBoardNotation,
} from "@/games/parking-jam/ui/board/parking-jam-board-notation";

type HowToPlayFigureProps = ParkingJamBoardNotation & {
  selectedVehicleId?: ParkingJamVehicleId;
};

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
