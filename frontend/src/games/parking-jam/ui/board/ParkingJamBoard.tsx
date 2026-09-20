import type { CSSProperties } from "react";

import type { ParkingJamOperation } from "@/games/parking-jam/play/use-parking-jam-play";
import type {
  ParkingJamBoard as ParkingJamBoardDefinition,
  ParkingJamFixedArea,
  ParkingJamRoadOpening,
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
  onExitAnimationComplete?: () => void;
};

function getFixedAreaStyle(
  area: ParkingJamFixedArea,
  board: ParkingJamBoardDefinition,
): CSSProperties {
  return {
    left: `${(area.column / board.width) * 100}%`,
    top: `${(area.row / board.height) * 100}%`,
    width: `${(area.width / board.width) * 100}%`,
    height: `${(area.height / board.height) * 100}%`,
  };
}

function getRoadOpeningStyle(
  opening: ParkingJamRoadOpening,
  board: ParkingJamBoardDefinition,
): CSSProperties {
  const cellWidth = 100 / board.width;
  const cellHeight = 100 / board.height;

  if (opening.side === "left") {
    return {
      left: 0,
      top: `${opening.startOffset * cellHeight}%`,
      width: "0.35rem",
      height: `${opening.length * cellHeight}%`,
    };
  }
  if (opening.side === "right") {
    return {
      right: 0,
      top: `${opening.startOffset * cellHeight}%`,
      width: "0.35rem",
      height: `${opening.length * cellHeight}%`,
    };
  }
  if (opening.side === "up") {
    return {
      top: 0,
      left: `${opening.startOffset * cellWidth}%`,
      width: `${opening.length * cellWidth}%`,
      height: "0.35rem",
    };
  }

  return {
    bottom: 0,
    left: `${opening.startOffset * cellWidth}%`,
    width: `${opening.length * cellWidth}%`,
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
  onExitAnimationComplete,
}: ParkingJamBoardProps) {
  const remainingVehicleIds = new Set(state.remainingVehicleIds);

  return (
    <div
      role="group"
      aria-label="パーキングジャム盤面"
      className="relative aspect-square w-full max-w-lg overflow-hidden rounded-2xl bg-slate-700 shadow-inner ring-2 ring-slate-950/20"
      style={getBoardStyle(board)}
    >
      {board.roadOpenings.map((opening) => (
        <span
          key={`${opening.side}-${opening.startOffset}-${opening.length}`}
          aria-hidden="true"
          className="absolute z-30 bg-background shadow-[0_0_0_2px_rgb(255_255_255_/_0.45)]"
          style={getRoadOpeningStyle(opening, board)}
        />
      ))}

      {board.fixedAreas.map((area) => (
        <span
          key={`${area.row}-${area.column}-${area.width}-${area.height}`}
          aria-hidden="true"
          className="absolute z-10 p-1.5"
          style={getFixedAreaStyle(area, board)}
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
            onExitAnimationComplete={
              exiting ? onExitAnimationComplete : undefined
            }
          />
        );
      })}
    </div>
  );
}
