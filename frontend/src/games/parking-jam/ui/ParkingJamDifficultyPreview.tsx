import type { CSSProperties } from "react";

import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import { ParkingJamBoardDefs } from "@/games/parking-jam/ui/board/ParkingJamBoardDefs";
import { ParkingJamCar } from "@/games/parking-jam/ui/board/ParkingJamCar";
import { ParkingJamLot } from "@/games/parking-jam/ui/board/ParkingJamLot";
import {
  PARKING_JAM_CELL,
  PARKING_JAM_MARGIN,
} from "@/games/parking-jam/ui/board/parking-jam-board-geometry";
import { useParkingJamBoardPaint } from "@/games/parking-jam/ui/board/parking-jam-board-paint";
import { parkingJamDifficultyPreviewProblems } from "@/games/parking-jam/ui/difficulty-preview-problems";

import "@/games/parking-jam/ui/board/parking-jam-board.css";

type ParkingJamDifficultyPreviewProps = {
  difficulty: ParkingJamDifficulty;
};

export function ParkingJamDifficultyPreview({
  difficulty,
}: ParkingJamDifficultyPreviewProps) {
  const { board } = parkingJamDifficultyPreviewProblems[difficulty];
  const paint = useParkingJamBoardPaint();
  const viewWidth = board.width * PARKING_JAM_CELL + PARKING_JAM_MARGIN * 2;
  const viewHeight = board.height * PARKING_JAM_CELL + PARKING_JAM_MARGIN * 2;
  // 盤面規模の違いを比較できるよう、全難易度で同じ縮尺にする。
  const scaleStyle = {
    "--parking-jam-preview-view-width": viewWidth,
  } as CSSProperties;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`${-PARKING_JAM_MARGIN} ${-PARKING_JAM_MARGIN} ${viewWidth} ${viewHeight}`}
      className="pointer-events-none h-auto w-[calc(var(--parking-jam-preview-view-width)*0.1px)] shrink-0 sm:w-[calc(var(--parking-jam-preview-view-width)*0.125px)]"
      style={scaleStyle}
    >
      <ParkingJamBoardDefs board={board} paint={paint} />
      <ParkingJamLot board={board} paint={paint} />
      <g clipPath={paint.vehicleSpaceClipPath}>
        {board.vehicles.map((vehicle) => (
          <ParkingJamCar
            key={vehicle.id}
            vehicle={vehicle}
            glassFill={paint.glassFill}
          />
        ))}
      </g>
    </svg>
  );
}
