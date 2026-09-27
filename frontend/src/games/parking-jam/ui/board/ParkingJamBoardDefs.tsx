import type { ParkingJamBoard } from "@/games/parking-jam/puzzle/board";
import {
  PARKING_JAM_CELL,
  parkingJamBoardGeometry,
} from "@/games/parking-jam/ui/board/parking-jam-board-geometry";
import type { ParkingJamBoardPaint } from "@/games/parking-jam/ui/board/parking-jam-board-paint";

type ParkingJamBoardDefsProps = {
  board: ParkingJamBoard;
  paint: ParkingJamBoardPaint;
};

export function ParkingJamBoardDefs({
  board,
  paint,
}: ParkingJamBoardDefsProps) {
  const width = board.width * PARKING_JAM_CELL;
  const height = board.height * PARKING_JAM_CELL;

  return (
    <defs>
      <linearGradient id={paint.lotGradientId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#596267" />
        <stop offset="0.55" stopColor="#4d565b" />
        <stop offset="1" stopColor="#424a4e" />
      </linearGradient>
      <linearGradient id={paint.glassGradientId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#eaf8ff" />
        <stop offset="0.45" stopColor="#a9cddd" />
        <stop offset="1" stopColor="#5f8294" />
      </linearGradient>
      <clipPath id={paint.vehicleSpaceClipId}>
        <rect width={width} height={height} />
        {board.roadOpenings.map((opening) => {
          const geometry = parkingJamBoardGeometry.getAccessRoadGeometry(
            opening,
            board,
          );
          return (
            <rect
              key={`clip-${opening.side}-${opening.startOffset}-${opening.length}`}
              {...geometry}
            />
          );
        })}
      </clipPath>
      <pattern
        id={paint.asphaltPatternId}
        width="32"
        height="32"
        patternUnits="userSpaceOnUse"
      >
        <circle
          cx="5"
          cy="8"
          r="1.2"
          className="parking-jam-board__asphalt-speck"
        />
        <circle
          cx="22"
          cy="5"
          r="0.8"
          className="parking-jam-board__asphalt-speck"
        />
        <circle
          cx="14"
          cy="23"
          r="1"
          className="parking-jam-board__asphalt-speck"
        />
        <circle
          cx="29"
          cy="27"
          r="0.7"
          className="parking-jam-board__asphalt-speck"
        />
      </pattern>
    </defs>
  );
}
