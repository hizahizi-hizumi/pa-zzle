import type { CSSProperties } from "react";

import type { ParkingJamOperation } from "@/games/parking-jam/play/use-parking-jam-play";
import type {
  ParkingJamBoard as ParkingJamBoardDefinition,
  ParkingJamDirection,
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
  onMove: (
    vehicleId: ParkingJamVehicleId,
    direction: ParkingJamDirection,
  ) => void;
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
  if (opening.side === "left")
    return {
      left: "-3%",
      top: `${opening.startOffset * cellHeight}%`,
      width: "7%",
      height: `${opening.length * cellHeight}%`,
    };
  if (opening.side === "right")
    return {
      right: "-3%",
      top: `${opening.startOffset * cellHeight}%`,
      width: "7%",
      height: `${opening.length * cellHeight}%`,
    };
  if (opening.side === "up")
    return {
      top: "-3%",
      left: `${opening.startOffset * cellWidth}%`,
      width: `${opening.length * cellWidth}%`,
      height: "7%",
    };
  return {
    bottom: "-3%",
    left: `${opening.startOffset * cellWidth}%`,
    width: `${opening.length * cellWidth}%`,
    height: "7%",
  };
}

export function ParkingJamBoard({
  board,
  state,
  selectedVehicleId,
  operation,
  interactionDisabled,
  onSelectVehicle,
  onMove,
  onExitAnimationComplete,
}: ParkingJamBoardProps) {
  const remainingVehicleIds = new Set(state.remainingVehicleIds);

  return (
    <div className="parking-jam-scene w-full max-w-lg">
      <div
        role="group"
        aria-label="パーキングジャム盤面"
        className="parking-jam-lot relative aspect-square w-full"
      >
        <div aria-hidden="true" className="parking-jam-lot__asphalt" />
        <div aria-hidden="true" className="parking-jam-lot__curb" />
        {board.roadOpenings.map((opening) => (
          <span
            key={`${opening.side}-${opening.startOffset}-${opening.length}`}
            aria-hidden="true"
            className={`parking-jam-road-opening parking-jam-road-opening--${opening.side}`}
            style={getRoadOpeningStyle(opening, board)}
          />
        ))}
        {board.fixedAreas.map((area) => (
          <span
            key={`${area.row}-${area.column}-${area.width}-${area.height}`}
            aria-hidden="true"
            className="parking-jam-fixed-area absolute z-10"
            style={getFixedAreaStyle(area, board)}
          >
            <span className="parking-jam-fixed-area__inner" />
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
                targetedByOperation
                  ? `${vehicle.id}-${operation.id}`
                  : vehicle.id
              }
              vehicle={vehicle}
              boardWidth={board.width}
              boardHeight={board.height}
              colorIndex={colorIndex}
              selected={selectedVehicleId === vehicle.id}
              feedback={feedback}
              feedbackDirection={
                targetedByOperation ? operation.direction : null
              }
              disabled={interactionDisabled || exiting}
              onSelect={() => onSelectVehicle(vehicle.id)}
              onDirection={(direction) => onMove(vehicle.id, direction)}
              onExitAnimationComplete={
                exiting ? onExitAnimationComplete : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
