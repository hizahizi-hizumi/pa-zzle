import type { CSSProperties } from "react";

import type { ParkingJamOperation } from "@/games/parking-jam/play/use-parking-jam-play";
import type {
  ParkingJamBoard as ParkingJamBoardDefinition,
  ParkingJamCell,
  ParkingJamExit,
  ParkingJamState,
  ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import { ParkingJamVehicle } from "@/games/parking-jam/ui/board/ParkingJamVehicle";

import "./parking-jam-board.css";

type ParkingJamBoardProps = {
  board: ParkingJamBoardDefinition;
  state: ParkingJamState;
  selectedVehicleId: ParkingJamVehicleId | null;
  operation: ParkingJamOperation | null;
  interactionDisabled: boolean;
  onSelectVehicle: (vehicleId: ParkingJamVehicleId) => void;
};

function getCellStyle(
  cell: ParkingJamCell,
  board: ParkingJamBoardDefinition,
): CSSProperties {
  return {
    left: `${(cell.column / board.width) * 100}%`,
    top: `${(cell.row / board.height) * 100}%`,
    width: `${100 / board.width}%`,
    height: `${100 / board.height}%`,
  };
}

function getExitStyle(
  exit: ParkingJamExit,
  board: ParkingJamBoardDefinition,
): CSSProperties {
  const cellWidth = 100 / board.width;
  const cellHeight = 100 / board.height;

  if (exit.side === "left") {
    return {
      left: 0,
      top: `${exit.offset * cellHeight + cellHeight * 0.18}%`,
      width: "0.35rem",
      height: `${cellHeight * 0.64}%`,
    };
  }
  if (exit.side === "right") {
    return {
      right: 0,
      top: `${exit.offset * cellHeight + cellHeight * 0.18}%`,
      width: "0.35rem",
      height: `${cellHeight * 0.64}%`,
    };
  }
  if (exit.side === "up") {
    return {
      top: 0,
      left: `${exit.offset * cellWidth + cellWidth * 0.18}%`,
      width: `${cellWidth * 0.64}%`,
      height: "0.35rem",
    };
  }

  return {
    bottom: 0,
    left: `${exit.offset * cellWidth + cellWidth * 0.18}%`,
    width: `${cellWidth * 0.64}%`,
    height: "0.35rem",
  };
}

function getBoardStyle(board: ParkingJamBoardDefinition): CSSProperties {
  return {
    backgroundImage:
      "linear-gradient(rgb(255 255 255 / 0.08) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.08) 1px, transparent 1px)",
    backgroundSize: `${100 / board.width}% ${100 / board.height}%`,
  };
}

export function ParkingJamBoard({
  board,
  state,
  selectedVehicleId,
  operation,
  interactionDisabled,
  onSelectVehicle,
}: ParkingJamBoardProps) {
  const remainingVehicleIds = new Set(state.remainingVehicleIds);

  return (
    <div
      role="group"
      aria-label="パーキングジャム盤面"
      className="relative aspect-square w-full max-w-lg overflow-hidden rounded-2xl bg-slate-700 shadow-inner ring-2 ring-slate-950/20"
      style={getBoardStyle(board)}
    >
      {board.exits.map((exit) => (
        <span
          key={`${exit.side}-${exit.offset}`}
          aria-hidden="true"
          className="absolute z-30 bg-background shadow-[0_0_0_2px_rgb(255_255_255_/_0.45)]"
          style={getExitStyle(exit, board)}
        />
      ))}

      {board.obstacles.map((obstacle) => (
        <span
          key={`${obstacle.row}-${obstacle.column}`}
          aria-hidden="true"
          className="absolute z-10 p-1.5"
          style={getCellStyle(obstacle, board)}
        >
          <span className="block size-full rounded-lg bg-emerald-900/80 shadow-inner ring-1 ring-white/10" />
        </span>
      ))}

      {board.vehicles.map((vehicle, colorIndex) => {
        const remaining = remainingVehicleIds.has(vehicle.id);
        const exiting =
          operation?.type === "exited" && operation.vehicleId === vehicle.id;
        if (!remaining && !exiting) return null;

        const targetedByOperation = operation?.vehicleId === vehicle.id;
        const feedback = targetedByOperation
          ? operation.type === "blocked"
            ? "blocked"
            : "exiting"
          : null;

        return (
          <ParkingJamVehicle
            key={
              targetedByOperation ? `${vehicle.id}-${operation.id}` : vehicle.id
            }
            vehicle={vehicle}
            boardWidth={board.width}
            boardHeight={board.height}
            colorIndex={colorIndex}
            selected={selectedVehicleId === vehicle.id}
            feedback={feedback}
            feedbackDirection={targetedByOperation ? operation.direction : null}
            disabled={interactionDisabled || exiting}
            onSelect={() => onSelectVehicle(vehicle.id)}
          />
        );
      })}
    </div>
  );
}
