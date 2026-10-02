import type {
  ParkingJamBoard,
  ParkingJamSide,
  ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import { ParkingJamBoardDefs } from "@/games/parking-jam/ui/board/ParkingJamBoardDefs";
import { ParkingJamCar } from "@/games/parking-jam/ui/board/ParkingJamCar";
import {
  getParkingJamDirectionControls,
  ParkingJamDirectionMark,
} from "@/games/parking-jam/ui/board/ParkingJamDirectionMark";
import { ParkingJamLot } from "@/games/parking-jam/ui/board/ParkingJamLot";
import { PARKING_JAM_CELL } from "@/games/parking-jam/ui/board/parking-jam-board-geometry";
import { useParkingJamBoardPaint } from "@/games/parking-jam/ui/board/parking-jam-board-paint";

import "@/games/parking-jam/ui/board/parking-jam-board.css";

// 開口のある辺は道路が外へ続いて見える幅を、ない辺は縁石が収まる幅だけを残す。
const FIGURE_ROAD_MARGIN = 50;
const FIGURE_CURB_MARGIN = 20;

function getFigureMargin(board: ParkingJamBoard, side: ParkingJamSide) {
  return board.roadOpenings.some((opening) => opening.side === side)
    ? FIGURE_ROAD_MARGIN
    : FIGURE_CURB_MARGIN;
}

type ParkingJamBoardFigureProps = {
  board: ParkingJamBoard;
  /** 盤面と同じ選択の縁取りと、両端の出庫方向の矢印を付ける車。 */
  selectedVehicleId?: ParkingJamVehicleId;
};

/**
 * 盤面と同じ見た目で、操作できない小さな駐車場を描く。
 * 高さいっぱいに広がるので、大きさは置き場所の高さで決める。
 */
export function ParkingJamBoardFigure({
  board,
  selectedVehicleId,
}: ParkingJamBoardFigureProps) {
  const paint = useParkingJamBoardPaint();
  const left = getFigureMargin(board, "left");
  const top = getFigureMargin(board, "up");
  const viewWidth =
    board.width * PARKING_JAM_CELL + left + getFigureMargin(board, "right");
  const viewHeight =
    board.height * PARKING_JAM_CELL + top + getFigureMargin(board, "down");
  const selectedVehicle = board.vehicles.find(
    (vehicle) => vehicle.id === selectedVehicleId,
  );

  return (
    <svg
      focusable="false"
      viewBox={`${-left} ${-top} ${viewWidth} ${viewHeight}`}
      className="pointer-events-none h-full w-auto"
    >
      <ParkingJamBoardDefs board={board} paint={paint} />
      <ParkingJamLot board={board} paint={paint} />
      <g clipPath={paint.vehicleSpaceClipPath}>
        {board.vehicles.map((vehicle) => (
          <g
            key={vehicle.id}
            className={
              vehicle.id === selectedVehicleId
                ? "parking-jam-car--selected"
                : undefined
            }
          >
            <ParkingJamCar vehicle={vehicle} glassFill={paint.glassFill} />
          </g>
        ))}
      </g>
      {selectedVehicle
        ? getParkingJamDirectionControls(selectedVehicle).map((control) => (
            <ParkingJamDirectionMark
              key={control.direction}
              control={control}
            />
          ))
        : null}
    </svg>
  );
}
