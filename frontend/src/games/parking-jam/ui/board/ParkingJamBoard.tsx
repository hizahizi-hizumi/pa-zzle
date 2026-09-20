import { type KeyboardEvent, type PointerEvent, useRef } from "react";

import type { ParkingJamOperation } from "@/games/parking-jam/play/use-parking-jam-play";
import type {
  ParkingJamBoard as ParkingJamBoardDefinition,
  ParkingJamDirection,
  ParkingJamRoadOpening,
  ParkingJamState,
  ParkingJamVehicle,
  ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";

import "./parking-jam-board.css";

type ParkingJamBoardProps = {
  board: ParkingJamBoardDefinition;
  state: ParkingJamState;
  selectedVehicleId: ParkingJamVehicleId | null;
  operation: ParkingJamOperation | null;
  interactionDisabled: boolean;
  onSelectVehicle: (vehicleId: ParkingJamVehicleId) => void;
  onMove: (vehicleId: ParkingJamVehicleId, direction: ParkingJamDirection) => void;
  onExitAnimationComplete?: () => void;
};

const CELL = 100;
const MARGIN = 26;
const SWIPE_THRESHOLD = 18;

function getOpeningGeometry(opening: ParkingJamRoadOpening, board: ParkingJamBoardDefinition) {
  const start = opening.startOffset * CELL;
  const length = opening.length * CELL;
  if (opening.side === "up") return { x: start, y: -MARGIN, width: length, height: MARGIN + 4 };
  if (opening.side === "down") return { x: start, y: board.height * CELL - 4, width: length, height: MARGIN + 4 };
  if (opening.side === "left") return { x: -MARGIN, y: start, width: MARGIN + 4, height: length };
  return { x: board.width * CELL - 4, y: start, width: MARGIN + 4, height: length };
}

function getSwipeDirection(vehicle: ParkingJamVehicle, deltaX: number, deltaY: number): ParkingJamDirection | null {
  if (vehicle.orientation === "horizontal") {
    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY)) return null;
    return deltaX < 0 ? "left" : "right";
  }
  if (Math.abs(deltaY) < SWIPE_THRESHOLD || Math.abs(deltaY) < Math.abs(deltaX)) return null;
  return deltaY < 0 ? "up" : "down";
}

function getVehicleLabel(vehicle: ParkingJamVehicle) {
  return `${vehicle.orientation === "horizontal" ? "横向き" : "縦向き"}の車 行${vehicle.row + 1} 列${vehicle.column + 1}`;
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
  const pointerStart = useRef<{ vehicleId: string; x: number; y: number } | null>(null);
  const remaining = new Set(state.remainingVehicleIds);
  const width = board.width * CELL;
  const height = board.height * CELL;

  function handlePointerDown(event: PointerEvent<SVGGElement>, vehicle: ParkingJamVehicle) {
    if (interactionDisabled) return;
    pointerStart.current = { vehicleId: vehicle.id, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerUp(event: PointerEvent<SVGGElement>, vehicle: ParkingJamVehicle) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.vehicleId !== vehicle.id || interactionDisabled) return;
    const direction = getSwipeDirection(vehicle, event.clientX - start.x, event.clientY - start.y);
    if (direction) onMove(vehicle.id, direction);
    else onSelectVehicle(vehicle.id);
  }

  function handleKeyDown(event: KeyboardEvent<SVGGElement>, vehicle: ParkingJamVehicle) {
    if (interactionDisabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectVehicle(vehicle.id);
    }
  }

  return (
    <svg
      role="group"
      aria-label="パーキングジャム盤面"
      viewBox={`${-MARGIN} ${-MARGIN} ${width + MARGIN * 2} ${height + MARGIN * 2}`}
      className="parking-jam-board"
    >
      <rect x={-MARGIN} y={-MARGIN} width={width + MARGIN * 2} height={height + MARGIN * 2} rx="30" className="parking-jam-board__surround" />
      <rect width={width} height={height} rx="18" className="parking-jam-board__lot" />
      <rect x="8" y="8" width={width - 16} height={height - 16} rx="13" className="parking-jam-board__curb" />
      {board.roadOpenings.map((opening) => {
        const geometry = getOpeningGeometry(opening, board);
        return <rect key={`${opening.side}-${opening.startOffset}-${opening.length}`} {...geometry} className="parking-jam-board__opening" />;
      })}
      {board.fixedAreas.map((area) => (
        <rect
          key={`${area.row}-${area.column}-${area.width}-${area.height}`}
          x={area.column * CELL + 10}
          y={area.row * CELL + 10}
          width={area.width * CELL - 20}
          height={area.height * CELL - 20}
          rx="14"
          className="parking-jam-board__island"
        />
      ))}
      {board.vehicles.map((vehicle) => {
        const isRemaining = remaining.has(vehicle.id);
        const targeted = operation?.vehicleId === vehicle.id;
        const exiting = targeted && operation?.type === "exited";
        if (!isRemaining && !exiting) return null;
        const horizontal = vehicle.orientation === "horizontal";
        const vehicleWidth = (horizontal ? vehicle.length : 1) * CELL - 20;
        const vehicleHeight = (horizontal ? 1 : vehicle.length) * CELL - 20;
        const x = vehicle.column * CELL + 10;
        const y = vehicle.row * CELL + 10;
        const selected = selectedVehicleId === vehicle.id;
        const feedbackClass = targeted && operation
          ? ` parking-jam-car--${operation.type === "exited" ? "exit" : "blocked"}-${operation.direction}`
          : "";
        return (
          <g
            key={targeted ? `${vehicle.id}-${operation?.id}` : vehicle.id}
            role="button"
            tabIndex={interactionDisabled || exiting ? -1 : 0}
            aria-label={getVehicleLabel(vehicle)}
            aria-pressed={selected}
            className={`parking-jam-car${selected ? " parking-jam-car--selected" : ""}${feedbackClass}`}
            onPointerDown={(event) => handlePointerDown(event, vehicle)}
            onPointerUp={(event) => handlePointerUp(event, vehicle)}
            onKeyDown={(event) => handleKeyDown(event, vehicle)}
            onAnimationEnd={exiting ? onExitAnimationComplete : undefined}
          >
            <rect x={x} y={y} width={vehicleWidth} height={vehicleHeight} rx="20" className="parking-jam-car__body" />
            <rect
              x={x + (horizontal ? vehicleWidth * 0.3 : vehicleWidth * 0.2)}
              y={y + (horizontal ? vehicleHeight * 0.2 : vehicleHeight * 0.3)}
              width={horizontal ? vehicleWidth * 0.4 : vehicleWidth * 0.6}
              height={horizontal ? vehicleHeight * 0.6 : vehicleHeight * 0.4}
              rx="12"
              className="parking-jam-car__glass"
            />
            <path
              d={horizontal
                ? `M ${x + vehicleWidth * 0.18} ${y + 7} V ${y + vehicleHeight - 7} M ${x + vehicleWidth * 0.82} ${y + 7} V ${y + vehicleHeight - 7}`
                : `M ${x + 7} ${y + vehicleHeight * 0.18} H ${x + vehicleWidth - 7} M ${x + 7} ${y + vehicleHeight * 0.82} H ${x + vehicleWidth - 7}`}
              className="parking-jam-car__detail"
            />
          </g>
        );
      })}
    </svg>
  );
}

export const _private = { getOpeningGeometry, getSwipeDirection };
