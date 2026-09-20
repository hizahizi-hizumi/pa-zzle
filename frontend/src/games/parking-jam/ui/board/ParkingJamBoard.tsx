import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useRef,
} from "react";

import type { ParkingJamOperation } from "@/games/parking-jam/play/use-parking-jam-play";
import type {
  ParkingJamBoard as ParkingJamBoardDefinition,
  ParkingJamDirection,
  ParkingJamFixedArea,
  ParkingJamState,
  ParkingJamVehicle,
  ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";

import {
  PARKING_JAM_CELL,
  PARKING_JAM_MARGIN,
  parkingJamBoardGeometry,
} from "./parking-jam-board-geometry";

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

const SWIPE_THRESHOLD = 18;

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

function isVehicleFacingPositiveDirection(vehicle: ParkingJamVehicle): boolean {
  const idWeight = [...vehicle.id].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );
  return idWeight % 2 === 0;
}

type DirectionControl = {
  direction: ParkingJamDirection;
  cx: number;
  cy: number;
  path: string;
};

function getDirectionControls(vehicle: ParkingJamVehicle): DirectionControl[] {
  const horizontal = vehicle.orientation === "horizontal";
  const width = (horizontal ? vehicle.length : 1) * PARKING_JAM_CELL - 20;
  const height = (horizontal ? 1 : vehicle.length) * PARKING_JAM_CELL - 20;
  const x = vehicle.column * PARKING_JAM_CELL + 10;
  const y = vehicle.row * PARKING_JAM_CELL + 10;
  const inset = 27;
  const arrowHalf = 8;

  if (horizontal) {
    const cy = y + height / 2;
    const left = x + inset;
    const right = x + width - inset;
    return [
      {
        direction: "left",
        cx: left,
        cy,
        path: `M ${left + arrowHalf} ${cy - arrowHalf} L ${left - 4} ${cy} L ${left + arrowHalf} ${cy + arrowHalf}`,
      },
      {
        direction: "right",
        cx: right,
        cy,
        path: `M ${right - arrowHalf} ${cy - arrowHalf} L ${right + 4} ${cy} L ${right - arrowHalf} ${cy + arrowHalf}`,
      },
    ];
  }

  const cx = x + width / 2;
  const up = y + inset;
  const down = y + height - inset;
  return [
    {
      direction: "up",
      cx,
      cy: up,
      path: `M ${cx - arrowHalf} ${up + arrowHalf} L ${cx} ${up - 4} L ${cx + arrowHalf} ${up + arrowHalf}`,
    },
    {
      direction: "down",
      cx,
      cy: down,
      path: `M ${cx - arrowHalf} ${down - arrowHalf} L ${cx} ${down + 4} L ${cx + arrowHalf} ${down - arrowHalf}`,
    },
  ];
}

type IslandShrub = {
  cx: number;
  cy: number;
  radius: number;
};

function getIslandShrubs(area: ParkingJamFixedArea): IslandShrub[] {
  const centerX = (area.column + area.width / 2) * PARKING_JAM_CELL;
  const centerY = (area.row + area.height / 2) * PARKING_JAM_CELL;
  const radius = Math.min(area.width, area.height) * PARKING_JAM_CELL * 0.11;
  const spread = Math.max(area.width, area.height) * PARKING_JAM_CELL * 0.18;

  return area.width >= area.height
    ? [
        { cx: centerX - spread, cy: centerY, radius },
        { cx: centerX + spread, cy: centerY, radius },
      ]
    : [
        { cx: centerX, cy: centerY - spread, radius },
        { cx: centerX, cy: centerY + spread, radius },
      ];
}

function getDirectionLabel(direction: ParkingJamDirection): string {
  switch (direction) {
    case "left":
      return "左";
    case "right":
      return "右";
    case "up":
      return "上";
    case "down":
      return "下";
  }
}

function getKeyboardDirection(
  vehicle: ParkingJamVehicle,
  key: string,
): ParkingJamDirection | null {
  if (vehicle.orientation === "horizontal") {
    if (key === "ArrowLeft") return "left";
    if (key === "ArrowRight") return "right";
    return null;
  }
  if (key === "ArrowUp") return "up";
  if (key === "ArrowDown") return "down";
  return null;
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
  const width = board.width * PARKING_JAM_CELL;
  const height = board.height * PARKING_JAM_CELL;
  const boundaryCurbs = parkingJamBoardGeometry.getBoundaryCurbLines(board);
  const parkingBayLines = parkingJamBoardGeometry.getParkingBayLines(board);
  const selectedVehicle = board.vehicles.find(
    (vehicle) => vehicle.id === selectedVehicleId && remaining.has(vehicle.id),
  );

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
    const direction = getKeyboardDirection(vehicle, event.key);
    if (direction) {
      event.preventDefault();
      onMove(vehicle.id, direction);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectVehicle(vehicle.id);
    }
  }

  return (
    <svg
      role="group"
      aria-label="パーキングジャム盤面"
      viewBox={`${-PARKING_JAM_MARGIN} ${-PARKING_JAM_MARGIN} ${width + PARKING_JAM_MARGIN * 2} ${height + PARKING_JAM_MARGIN * 2}`}
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
      <rect width={width} height={height} className="parking-jam-board__lot" />
      <rect width={width} height={height} fill="url(#parking-jam-asphalt)" />
      {board.roadOpenings.map((opening) => {
        const geometry = parkingJamBoardGeometry.getAccessRoadGeometry(
          opening,
          board,
        );
        return (
          <g key={`${opening.side}-${opening.startOffset}-${opening.length}`}>
            <rect {...geometry} className="parking-jam-board__access-road" />
            <rect {...geometry} fill="url(#parking-jam-asphalt)" />
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
          {getIslandShrubs(area).map((shrub) => (
            <g key={`shrub-${shrub.cx}-${shrub.cy}`}>
              <circle
                cx={shrub.cx + 3}
                cy={shrub.cy + 4}
                r={shrub.radius + 2}
                className="parking-jam-board__shrub-shadow"
              />
              <circle
                cx={shrub.cx}
                cy={shrub.cy}
                r={shrub.radius}
                className="parking-jam-board__shrub"
              />
            </g>
          ))}
        </g>
      ))}
      {board.vehicles.map((vehicle) => {
        const isRemaining = remaining.has(vehicle.id);
        const targeted = operation?.vehicleId === vehicle.id;
        const exiting = targeted && operation?.type === "exited";
        if (!isRemaining && !exiting) return null;
        const horizontal = vehicle.orientation === "horizontal";
        const vehicleWidth =
          (horizontal ? vehicle.length : 1) * PARKING_JAM_CELL - 20;
        const vehicleHeight =
          (horizontal ? 1 : vehicle.length) * PARKING_JAM_CELL - 20;
        const x = vehicle.column * PARKING_JAM_CELL + 10;
        const y = vehicle.row * PARKING_JAM_CELL + 10;
        const selected = selectedVehicleId === vehicle.id;
        const facingPositive = isVehicleFacingPositiveDirection(vehicle);
        const frontX = horizontal
          ? facingPositive
            ? x + vehicleWidth - 7
            : x + 7
          : null;
        const rearX = horizontal
          ? facingPositive
            ? x + 7
            : x + vehicleWidth - 7
          : null;
        const frontY = horizontal
          ? null
          : facingPositive
            ? y + vehicleHeight - 7
            : y + 7;
        const rearY = horizontal
          ? null
          : facingPositive
            ? y + 7
            : y + vehicleHeight - 7;
        const feedbackClass =
          targeted && operation
            ? ` parking-jam-car--${operation.type === "exited" ? "exit" : "blocked"}-${operation.direction}`
            : "";
        const exitTranslation =
          exiting && operation
            ? parkingJamBoardGeometry.getVehicleExitTranslation(
                board,
                vehicle,
                operation.direction,
              )
            : null;
        const exitStyle = exitTranslation
          ? ({
              "--parking-jam-exit-x": `${exitTranslation.x}px`,
              "--parking-jam-exit-y": `${exitTranslation.y}px`,
            } as CSSProperties)
          : undefined;
        return (
          <g
            key={targeted ? `${vehicle.id}-${operation?.id}` : vehicle.id}
            role="button"
            tabIndex={interactionDisabled || exiting ? -1 : 0}
            aria-label={getVehicleLabel(vehicle)}
            aria-pressed={selected}
            className={`parking-jam-car${selected ? " parking-jam-car--selected" : ""}${feedbackClass}`}
            style={exitStyle}
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
              cx={horizontal ? (frontX ?? 0) : x + vehicleWidth * 0.28}
              cy={horizontal ? y + vehicleHeight * 0.28 : (frontY ?? 0)}
              r="5"
              className="parking-jam-car__front-light"
            />
            <circle
              cx={horizontal ? (frontX ?? 0) : x + vehicleWidth * 0.72}
              cy={horizontal ? y + vehicleHeight * 0.72 : (frontY ?? 0)}
              r="5"
              className="parking-jam-car__front-light"
            />
            <circle
              cx={horizontal ? (rearX ?? 0) : x + vehicleWidth * 0.28}
              cy={horizontal ? y + vehicleHeight * 0.28 : (rearY ?? 0)}
              r="4.5"
              className="parking-jam-car__rear-light"
            />
            <circle
              cx={horizontal ? (rearX ?? 0) : x + vehicleWidth * 0.72}
              cy={horizontal ? y + vehicleHeight * 0.72 : (rearY ?? 0)}
              r="4.5"
              className="parking-jam-car__rear-light"
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
      {selectedVehicle && !interactionDisabled
        ? getDirectionControls(selectedVehicle).map((control) => (
            <g
              key={`direction-${selectedVehicle.id}-${control.direction}`}
              role="button"
              tabIndex={0}
              aria-label={`${getDirectionLabel(control.direction)}へ出庫`}
              className="parking-jam-direction-control"
              onClick={() => onMove(selectedVehicle.id, control.direction)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onMove(selectedVehicle.id, control.direction);
                }
              }}
            >
              <circle
                cx={control.cx}
                cy={control.cy}
                r="30"
                className="parking-jam-direction-control__hit"
              />
              <circle
                cx={control.cx}
                cy={control.cy}
                r="21"
                className="parking-jam-direction-control__surface"
              />
              <path
                d={control.path}
                className="parking-jam-direction-control__arrow"
              />
            </g>
          ))
        : null}
    </svg>
  );
}

export const _private = { getSwipeDirection };
