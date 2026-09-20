import type { CSSProperties } from "react";

import type { ParkingJamDifficulty } from "@/games/parking-jam/difficulty";
import type {
  ParkingJamCell,
  ParkingJamVehicle,
} from "@/games/parking-jam/puzzle/board";

const previewVehicles = {
  easy: [
    { id: "0", row: 2, column: 4, orientation: "vertical", length: 2 },
    { id: "1", row: 5, column: 7, orientation: "vertical", length: 3 },
    { id: "2", row: 3, column: 6, orientation: "horizontal", length: 2 },
    { id: "3", row: 5, column: 1, orientation: "horizontal", length: 2 },
    { id: "4", row: 0, column: 6, orientation: "vertical", length: 2 },
    { id: "5", row: 2, column: 1, orientation: "horizontal", length: 2 },
    { id: "6", row: 6, column: 0, orientation: "horizontal", length: 3 },
    { id: "7", row: 1, column: 1, orientation: "horizontal", length: 3 },
    { id: "8", row: 0, column: 4, orientation: "vertical", length: 2 },
    { id: "9", row: 4, column: 5, orientation: "horizontal", length: 2 },
    { id: "10", row: 6, column: 5, orientation: "vertical", length: 2 },
    { id: "11", row: 4, column: 3, orientation: "vertical", length: 3 },
    { id: "12", row: 3, column: 0, orientation: "horizontal", length: 3 },
    { id: "13", row: 1, column: 0, orientation: "vertical", length: 2 },
  ],
  normal: [
    { id: "0", row: 4, column: 7, orientation: "vertical", length: 2 },
    { id: "1", row: 2, column: 4, orientation: "vertical", length: 2 },
    { id: "2", row: 5, column: 4, orientation: "vertical", length: 3 },
    { id: "3", row: 6, column: 0, orientation: "vertical", length: 2 },
    { id: "4", row: 5, column: 3, orientation: "vertical", length: 3 },
    { id: "5", row: 7, column: 6, orientation: "horizontal", length: 2 },
    { id: "6", row: 4, column: 2, orientation: "vertical", length: 3 },
    { id: "7", row: 0, column: 1, orientation: "vertical", length: 2 },
    { id: "8", row: 4, column: 0, orientation: "vertical", length: 2 },
    { id: "9", row: 2, column: 0, orientation: "vertical", length: 2 },
    { id: "10", row: 0, column: 3, orientation: "vertical", length: 2 },
    { id: "11", row: 1, column: 2, orientation: "vertical", length: 2 },
    { id: "12", row: 0, column: 7, orientation: "vertical", length: 3 },
    { id: "13", row: 1, column: 5, orientation: "vertical", length: 2 },
  ],
  hard: [
    { id: "0", row: 2, column: 7, orientation: "vertical", length: 2 },
    { id: "1", row: 0, column: 7, orientation: "vertical", length: 2 },
    { id: "2", row: 7, column: 1, orientation: "horizontal", length: 3 },
    { id: "3", row: 6, column: 1, orientation: "horizontal", length: 2 },
    { id: "4", row: 6, column: 4, orientation: "vertical", length: 2 },
    { id: "5", row: 4, column: 3, orientation: "horizontal", length: 2 },
    { id: "6", row: 4, column: 5, orientation: "horizontal", length: 2 },
    { id: "7", row: 6, column: 5, orientation: "horizontal", length: 2 },
    { id: "8", row: 3, column: 1, orientation: "vertical", length: 3 },
    { id: "9", row: 0, column: 1, orientation: "vertical", length: 3 },
    { id: "10", row: 1, column: 3, orientation: "vertical", length: 3 },
    { id: "11", row: 2, column: 5, orientation: "vertical", length: 2 },
    { id: "12", row: 0, column: 5, orientation: "vertical", length: 2 },
    { id: "13", row: 2, column: 4, orientation: "vertical", length: 2 },
  ],
} as const satisfies Record<ParkingJamDifficulty, readonly ParkingJamVehicle[]>;

const previewObstacles = {
  easy: [
    { row: 0, column: 1 },
    { row: 3, column: 3 },
    { row: 2, column: 5 },
    { row: 7, column: 1 },
  ],
  normal: [
    { row: 3, column: 1 },
    { row: 0, column: 6 },
    { row: 5, column: 5 },
    { row: 1, column: 4 },
  ],
  hard: [
    { row: 5, column: 6 },
    { row: 7, column: 7 },
    { row: 1, column: 0 },
    { row: 2, column: 6 },
  ],
} as const satisfies Record<ParkingJamDifficulty, readonly ParkingJamCell[]>;

const vehicleColors = [
  "bg-cyan-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-violet-400",
  "bg-emerald-400",
] as const;

function getCellStyle(cell: ParkingJamCell): CSSProperties {
  return {
    left: `${cell.column * 12.5}%`,
    top: `${cell.row * 12.5}%`,
    width: "12.5%",
    height: "12.5%",
  };
}

function getVehicleStyle(vehicle: ParkingJamVehicle): CSSProperties {
  const horizontal = vehicle.orientation === "horizontal";
  return {
    left: `${vehicle.column * 12.5}%`,
    top: `${vehicle.row * 12.5}%`,
    width: `${(horizontal ? vehicle.length : 1) * 12.5}%`,
    height: `${(horizontal ? 1 : vehicle.length) * 12.5}%`,
  };
}

type ParkingJamDifficultyPreviewProps = {
  difficulty: ParkingJamDifficulty;
};

export function ParkingJamDifficultyPreview({
  difficulty,
}: ParkingJamDifficultyPreviewProps) {
  return (
    <span
      aria-hidden="true"
      className="relative block size-[100px] overflow-hidden rounded-xl bg-slate-700 shadow-inner ring-1 ring-slate-950/20 sm:size-[120px]"
    >
      {previewObstacles[difficulty].map((obstacle) => (
        <span
          key={`${obstacle.row}-${obstacle.column}`}
          className="absolute p-px"
          style={getCellStyle(obstacle)}
        >
          <span className="block size-full rounded-sm bg-emerald-900/80" />
        </span>
      ))}
      {previewVehicles[difficulty].map((vehicle, index) => (
        <span
          key={vehicle.id}
          className="absolute p-px"
          style={getVehicleStyle(vehicle)}
        >
          <span
            className={`block size-full rounded-[3px] ${vehicleColors[index % vehicleColors.length] ?? vehicleColors[0]}`}
          />
        </span>
      ))}
    </span>
  );
}
