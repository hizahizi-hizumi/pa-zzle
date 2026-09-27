import type { ParkingJamBoard } from "@/games/parking-jam/puzzle/board";
import {
  PARKING_JAM_CELL,
  parkingJamBoardGeometry,
} from "@/games/parking-jam/ui/board/parking-jam-board-geometry";
import type { ParkingJamBoardPaint } from "@/games/parking-jam/ui/board/parking-jam-board-paint";

type ParkingJamLotProps = {
  board: ParkingJamBoard;
  paint: ParkingJamBoardPaint;
};

export function ParkingJamLot({ board, paint }: ParkingJamLotProps) {
  const width = board.width * PARKING_JAM_CELL;
  const height = board.height * PARKING_JAM_CELL;
  const boundaryCurbs = parkingJamBoardGeometry.getBoundaryCurbLines(board);
  const parkingBayLines = parkingJamBoardGeometry.getParkingBayLines(board);

  return (
    <>
      <rect
        width={width}
        height={height}
        fill={paint.lotFill}
        className="parking-jam-board__lot"
      />
      <rect width={width} height={height} fill={paint.asphaltFill} />
      {board.roadOpenings.map((opening) => {
        const geometry = parkingJamBoardGeometry.getAccessRoadGeometry(
          opening,
          board,
        );
        return (
          <g key={`${opening.side}-${opening.startOffset}-${opening.length}`}>
            <rect
              {...geometry}
              fill={paint.lotFill}
              className="parking-jam-board__access-road"
            />
            <rect {...geometry} fill={paint.asphaltFill} />
            <line
              {...parkingJamBoardGeometry.getAccessRoadCenterLine(
                opening,
                board,
              )}
              className="parking-jam-board__road-marking"
            />
            {parkingJamBoardGeometry
              .getAccessRoadCurbLines(opening, board)
              .map((line) => (
                <line
                  key={`${opening.side}-${opening.startOffset}-curb-${line.x1}-${line.y1}-${line.x2}-${line.y2}`}
                  {...line}
                  className="parking-jam-board__curb"
                />
              ))}
          </g>
        );
      })}
      {parkingBayLines.map((line) => (
        <line
          key={`parking-bay-${line.x1}-${line.y1}-${line.x2}-${line.y2}`}
          {...line}
          className="parking-jam-board__parking-bay"
        />
      ))}
      {boundaryCurbs.map((line) => (
        <line
          key={`boundary-curb-${line.x1}-${line.y1}-${line.x2}-${line.y2}`}
          {...line}
          className="parking-jam-board__curb"
        />
      ))}
      {board.fixedAreas.map((area) => (
        <rect
          key={`${area.row}-${area.column}-${area.width}-${area.height}`}
          x={area.column * PARKING_JAM_CELL + 10}
          y={area.row * PARKING_JAM_CELL + 10}
          width={area.width * PARKING_JAM_CELL - 20}
          height={area.height * PARKING_JAM_CELL - 20}
          rx="8"
          className="parking-jam-board__island"
        />
      ))}

      {board.fixedAreas.map((area) => (
        <g
          key={`island-${area.row}-${area.column}-${area.width}-${area.height}`}
        >
          <rect
            x={area.column * PARKING_JAM_CELL + 25}
            y={area.row * PARKING_JAM_CELL + 25}
            width={area.width * PARKING_JAM_CELL - 50}
            height={area.height * PARKING_JAM_CELL - 50}
            rx="4"
            className="parking-jam-board__island-soil"
          />
          <rect
            x={area.column * PARKING_JAM_CELL + 34}
            y={area.row * PARKING_JAM_CELL + 34}
            width={area.width * PARKING_JAM_CELL - 68}
            height={area.height * PARKING_JAM_CELL - 68}
            rx="3"
            className="parking-jam-board__island-green"
          />
        </g>
      ))}
    </>
  );
}
