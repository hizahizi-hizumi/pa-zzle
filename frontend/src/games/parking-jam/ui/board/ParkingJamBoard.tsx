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
  onMove: (
    vehicleId: ParkingJamVehicleId,
    direction: ParkingJamDirection,
  ) => void;
  onExitAnimationComplete?: () => void;
};

const CELL = 100;
const MARGIN = 72;
const SWIPE_THRESHOLD = 18;

function getOpeningGeometry(
  opening: ParkingJamRoadOpening,
  board: ParkingJamBoardDefinition,
) {
  const start = opening.startOffset * CELL;
  const length = opening.length * CELL;
  if (opening.side === "up")
    return { x: start, y: -MARGIN, width: length, height: MARGIN + 4 };
  if (opening.side === "down")
    return {
      x: start,
      y: board.height * CELL - 4,
      width: length,
      height: MARGIN + 4,
    };
  if (opening.side === "left")
    return { x: -MARGIN, y: start, width: MARGIN + 4, height: length };
  return {
    x: board.width * CELL - 4,
    y: start,
    width: MARGIN + 4,
    height: length,
  };
}

function getSwipeDirection(
  vehicle: ParkingJamVehicle,
  deltaX: number,
  deltaY: number,
): ParkingJamDirection | null {
  if (vehicle.orientation === "horizontal") {
    if (
      Math.abs(deltaX) < SWIPE_THRESHOLD ||
      Math.abs(deltaX) < Math.abs(deltaY)
    )
      return null;
    return deltaX < 0 ? "left" : "right";
  }
  if (Math.abs(deltaY) < SWIPE_THRESHOLD || Math.abs(deltaY) < Math.abs(deltaX))
    return null;
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
  const pointerStart = useRef<{
    vehicleId: string;
    x: number;
    y: number;
  } | null>(null);
  const remaining = new Set(state.remainingVehicleIds);
  const width = board.width * CELL;
  const height = board.height * CELL;

  function handlePointerDown(
    event: PointerEvent<SVGGElement>,
    vehicle: ParkingJamVehicle,
  ) {
    if (interactionDisabled) return;
    pointerStart.current = {
      vehicleId: vehicle.id,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerUp(
    event: PointerEvent<SVGGElement>,
    vehicle: ParkingJamVehicle,
  ) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.vehicleId !== vehicle.id || interactionDisabled) return;
    const direction = getSwipeDirection(
      vehicle,
      event.clientX - start.x,
      event.clientY - start.y,
    );
    if (direction) onMove(vehicle.id, direction);
    else onSelectVehicle(vehicle.id);
  }

  function handleKeyDown(
    event: KeyboardEvent<SVGGElement>,
    vehicle: ParkingJamVehicle,
  ) {
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
      <defs>
        <linearGradient
          id="parking-jam-lot-gradient"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0" stopColor="#596267" />
          <stop offset="0.55" stopColor="#4d565b" />
          <stop offset="1" stopColor="#424a4e" />
        </linearGradient>
        <linearGradient id="parking-jam-car-red" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff6b62" />
          <stop offset="0.5" stopColor="#e84d45" />
          <stop offset="1" stopColor="#b92f35" />
        </linearGradient>
        <linearGradient
          id="parking-jam-glass-gradient"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0" stopColor="#eaf8ff" />
          <stop offset="0.45" stopColor="#a9cddd" />
          <stop offset="1" stopColor="#5f8294" />
        </linearGradient>
        <pattern
          id="parking-jam-asphalt"
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
      <rect
        x={-MARGIN}
        y={-MARGIN}
        width={width + MARGIN * 2}
        height={height + MARGIN * 2}
        rx="24"
        className="parking-jam-board__surround"
      />
      <rect
        x={-MARGIN}
        y={-MARGIN}
        width={width + MARGIN * 2}
        height={height + MARGIN * 2}
        rx="24"
        className="parking-jam-board__outside-paving"
      />
      <rect
        width={width}
        height={height}
        rx="18"
        className="parking-jam-board__lot"
      />
      <rect
        width={width}
        height={height}
        rx="18"
        fill="url(#parking-jam-asphalt)"
      />
      <rect
        x="7"
        y="7"
        width={width - 14}
        height={height - 14}
        rx="12"
        className="parking-jam-board__curb"
      />
      {Array.from({ length: board.width }).map((_, column) => (
        <path
          key={`parking-space-top-${column}`}
          d={`M ${column * CELL + 12} 14 V 68 M ${column * CELL + 12} 14 H ${(column + 1) * CELL - 12}`}
          className="parking-jam-board__parking-space"
        />
      ))}
      {Array.from({ length: board.width }).map((_, column) => (
        <path
          key={`parking-space-bottom-${column}`}
          d={`M ${column * CELL + 12} ${height - 14} V ${height - 68} M ${column * CELL + 12} ${height - 14} H ${(column + 1) * CELL - 12}`}
          className="parking-jam-board__parking-space"
        />
      ))}
      {board.roadOpenings.map((opening) => {
        const geometry = getOpeningGeometry(opening, board);
        return (
          <g key={`${opening.side}-${opening.startOffset}-${opening.length}`}>
            <rect {...geometry} className="parking-jam-board__opening" />
            <rect
              x={geometry.x + (opening.side === "left" || opening.side === "right" ? 0 : 10)}
              y={geometry.y + (opening.side === "up" || opening.side === "down" ? 0 : 10)}
              width={geometry.width - (opening.side === "up" || opening.side === "down" ? 20 : 0)}
              height={geometry.height - (opening.side === "left" || opening.side === "right" ? 20 : 0)}
              className="parking-jam-board__exit-road"
            />
          </g>
        );
      })}
      {board.roadOpenings.map((opening) => {
        const geometry = getOpeningGeometry(opening, board);
        const horizontal = opening.side === "up" || opening.side === "down";
        return (
          <g
            key={`guide-${opening.side}-${opening.startOffset}-${opening.length}`}
            className="parking-jam-board__exit-mark"
          >
            <path
              d={
                horizontal
                  ? `M ${geometry.x + geometry.width / 2} ${geometry.y + 8} V ${geometry.y + geometry.height - 8}`
                  : `M ${geometry.x + 8} ${geometry.y + geometry.height / 2} H ${geometry.x + geometry.width - 8}`
              }
            />
            <path
              d={
                opening.side === "left"
                  ? `M ${geometry.x + 12} ${geometry.y + geometry.height / 2} l 14 -10 v 20 z`
                  : opening.side === "right"
                    ? `M ${geometry.x + geometry.width - 12} ${geometry.y + geometry.height / 2} l -14 -10 v 20 z`
                    : opening.side === "up"
                      ? `M ${geometry.x + geometry.width / 2} ${geometry.y + 12} l -10 14 h 20 z`
                      : `M ${geometry.x + geometry.width / 2} ${geometry.y + geometry.height - 12} l -10 -14 h 20 z`
              }
              className="parking-jam-board__exit-arrow"
            />
          </g>
        );
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

      {board.fixedAreas.map((area) => (
        <g key={`island-${area.row}-${area.column}-${area.width}-${area.height}`}>
          <rect
            x={area.column * CELL + 17}
            y={area.row * CELL + 17}
            width={area.width * CELL - 34}
            height={area.height * CELL - 34}
            rx="11"
            className="parking-jam-board__island-soil"
          />
          <rect
            x={area.column * CELL + 27}
            y={area.row * CELL + 27}
            width={area.width * CELL - 54}
            height={area.height * CELL - 54}
            rx="8"
            className="parking-jam-board__island-green"
          />
          <circle
            cx={(area.column + area.width / 2) * CELL}
            cy={(area.row + area.height / 2) * CELL}
            r={Math.min(area.width, area.height) * CELL * 0.18}
            className="parking-jam-board__shrub"
          />
        </g>
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
        const feedbackClass =
          targeted && operation
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
            <rect
              x={x}
              y={y}
              width={vehicleWidth}
              height={vehicleHeight}
              rx="20"
              className="parking-jam-car__body"
            />
            <rect
              x={x + 6}
              y={y + 6}
              width={vehicleWidth - 12}
              height={vehicleHeight * 0.18}
              rx="8"
              className="parking-jam-car__highlight"
            />
            {horizontal ? (
              <>
                <rect
                  x={x + vehicleWidth * 0.24}
                  y={y + vehicleHeight * 0.2}
                  width={vehicleWidth * 0.18}
                  height={vehicleHeight * 0.6}
                  rx="8"
                  className="parking-jam-car__glass"
                />
                <rect
                  x={x + vehicleWidth * 0.58}
                  y={y + vehicleHeight * 0.2}
                  width={vehicleWidth * 0.18}
                  height={vehicleHeight * 0.6}
                  rx="8"
                  className="parking-jam-car__glass"
                />
              </>
            ) : (
              <>
                <rect
                  x={x + vehicleWidth * 0.2}
                  y={y + vehicleHeight * 0.24}
                  width={vehicleWidth * 0.6}
                  height={vehicleHeight * 0.18}
                  rx="8"
                  className="parking-jam-car__glass"
                />
                <rect
                  x={x + vehicleWidth * 0.2}
                  y={y + vehicleHeight * 0.58}
                  width={vehicleWidth * 0.6}
                  height={vehicleHeight * 0.18}
                  rx="8"
                  className="parking-jam-car__glass"
                />
              </>
            )}
            <path
              d={
                horizontal
                  ? `M ${x + vehicleWidth * 0.18} ${y + 7} V ${y + vehicleHeight - 7} M ${x + vehicleWidth * 0.82} ${y + 7} V ${y + vehicleHeight - 7}`
                  : `M ${x + 7} ${y + vehicleHeight * 0.18} H ${x + vehicleWidth - 7} M ${x + 7} ${y + vehicleHeight * 0.82} H ${x + vehicleWidth - 7}`
              }
              className="parking-jam-car__detail"
            />
            <circle
              cx={horizontal ? x + 7 : x + vehicleWidth * 0.28}
              cy={horizontal ? y + vehicleHeight * 0.28 : y + 7}
              r="5"
              className="parking-jam-car__light"
            />
            <circle
              cx={horizontal ? x + 7 : x + vehicleWidth * 0.72}
              cy={horizontal ? y + vehicleHeight * 0.72 : y + 7}
              r="5"
              className="parking-jam-car__light"
            />
            {horizontal ? (
              <>
                <rect
                  x={x + vehicleWidth * 0.16}
                  y={y - 3}
                  width={vehicleWidth * 0.18}
                  height="7"
                  rx="3.5"
                  className="parking-jam-car__wheel"
                />
                <rect
                  x={x + vehicleWidth * 0.66}
                  y={y - 3}
                  width={vehicleWidth * 0.18}
                  height="7"
                  rx="3.5"
                  className="parking-jam-car__wheel"
                />
                <rect
                  x={x + vehicleWidth * 0.16}
                  y={y + vehicleHeight - 4}
                  width={vehicleWidth * 0.18}
                  height="7"
                  rx="3.5"
                  className="parking-jam-car__wheel"
                />
                <rect
                  x={x + vehicleWidth * 0.66}
                  y={y + vehicleHeight - 4}
                  width={vehicleWidth * 0.18}
                  height="7"
                  rx="3.5"
                  className="parking-jam-car__wheel"
                />
              </>
            ) : (
              <>
                <rect
                  x={x - 3}
                  y={y + vehicleHeight * 0.16}
                  width="7"
                  height={vehicleHeight * 0.18}
                  rx="3.5"
                  className="parking-jam-car__wheel"
                />
                <rect
                  x={x - 3}
                  y={y + vehicleHeight * 0.66}
                  width="7"
                  height={vehicleHeight * 0.18}
                  rx="3.5"
                  className="parking-jam-car__wheel"
                />
                <rect
                  x={x + vehicleWidth - 4}
                  y={y + vehicleHeight * 0.16}
                  width="7"
                  height={vehicleHeight * 0.18}
                  rx="3.5"
                  className="parking-jam-car__wheel"
                />
                <rect
                  x={x + vehicleWidth - 4}
                  y={y + vehicleHeight * 0.66}
                  width="7"
                  height={vehicleHeight * 0.18}
                  rx="3.5"
                  className="parking-jam-car__wheel"
                />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export const _private = { getOpeningGeometry, getSwipeDirection };
