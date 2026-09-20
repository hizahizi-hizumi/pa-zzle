import {
  type AnimationEvent,
  type CSSProperties,
  type PointerEvent,
  useRef,
} from "react";

import type {
  ParkingJamDirection,
  ParkingJamVehicle as ParkingJamVehicleDefinition,
} from "@/games/parking-jam/puzzle/board";

import "./parking-jam-board.css";

type ParkingJamVehicleProps = {
  vehicle: ParkingJamVehicleDefinition;
  boardWidth: number;
  boardHeight: number;
  colorIndex: number;
  selected: boolean;
  feedback: "blocked" | "exiting" | null;
  feedbackDirection: ParkingJamDirection | null;
  disabled: boolean;
  onSelect: () => void;
  onDirection: (direction: ParkingJamDirection) => void;
  onExitAnimationComplete?: () => void;
};

const vehicleColorClassNames = [
  "parking-jam-vehicle--cyan",
  "parking-jam-vehicle--amber",
  "parking-jam-vehicle--rose",
  "parking-jam-vehicle--violet",
  "parking-jam-vehicle--emerald",
  "parking-jam-vehicle--orange",
  "parking-jam-vehicle--sky",
] as const;

function getFeedbackClassName(
  feedback: ParkingJamVehicleProps["feedback"],
  direction: ParkingJamDirection | null,
): string {
  if (!feedback || !direction) return "";
  return feedback === "blocked"
    ? `parking-jam-vehicle--blocked-${direction}`
    : `parking-jam-vehicle--exit-${direction}`;
}

function getVehicleStyle({
  vehicle,
  boardWidth,
  boardHeight,
}: Pick<
  ParkingJamVehicleProps,
  "vehicle" | "boardWidth" | "boardHeight"
>): CSSProperties {
  const horizontal = vehicle.orientation === "horizontal";
  return {
    left: `${(vehicle.column / boardWidth) * 100}%`,
    top: `${(vehicle.row / boardHeight) * 100}%`,
    width: `${((horizontal ? vehicle.length : 1) / boardWidth) * 100}%`,
    height: `${((horizontal ? 1 : vehicle.length) / boardHeight) * 100}%`,
  };
}

function getVehicleLabel(vehicle: ParkingJamVehicleDefinition): string {
  const orientation =
    vehicle.orientation === "horizontal" ? "横向き" : "縦向き";
  return `${orientation}の車 行${vehicle.row + 1} 列${vehicle.column + 1}`;
}

function getSwipeDirection(
  vehicle: ParkingJamVehicleDefinition,
  deltaX: number,
  deltaY: number,
): ParkingJamDirection | null {
  const threshold = 18;
  if (vehicle.orientation === "horizontal") {
    if (Math.abs(deltaX) < threshold || Math.abs(deltaX) < Math.abs(deltaY))
      return null;
    return deltaX < 0 ? "left" : "right";
  }
  if (Math.abs(deltaY) < threshold || Math.abs(deltaY) < Math.abs(deltaX))
    return null;
  return deltaY < 0 ? "up" : "down";
}

export function ParkingJamVehicle({
  vehicle,
  boardWidth,
  boardHeight,
  colorIndex,
  selected,
  feedback,
  feedbackDirection,
  disabled,
  onSelect,
  onDirection,
  onExitAnimationComplete,
}: ParkingJamVehicleProps) {
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const colorClassName =
    vehicleColorClassNames[colorIndex % vehicleColorClassNames.length] ??
    vehicleColorClassNames[0];
  const feedbackClassName = getFeedbackClassName(feedback, feedbackDirection);
  const directions: ParkingJamDirection[] =
    vehicle.orientation === "horizontal" ? ["left", "right"] : ["up", "down"];

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    swiped.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || disabled) return;
    const direction = getSwipeDirection(
      vehicle,
      event.clientX - start.x,
      event.clientY - start.y,
    );
    if (!direction) return;
    swiped.current = true;
    onDirection(direction);
  }

  function handleClick() {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    onSelect();
  }

  function handleAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (
      event.target === event.currentTarget &&
      feedback === "exiting" &&
      onExitAnimationComplete
    ) {
      onExitAnimationComplete();
    }
  }

  return (
    <div
      className={`parking-jam-vehicle absolute z-20 ${feedbackClassName}`}
      style={getVehicleStyle({ vehicle, boardWidth, boardHeight })}
      onAnimationEnd={handleAnimationEnd}
    >
      <button
        type="button"
        aria-label={getVehicleLabel(vehicle)}
        aria-pressed={selected}
        disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
        className={`parking-jam-vehicle__body ${colorClassName} ${
          selected ? "parking-jam-vehicle__body--selected" : ""
        }`}
      >
        <span aria-hidden="true" className="parking-jam-vehicle__cabin" />
        <span aria-hidden="true" className="parking-jam-vehicle__windshield" />
        <span
          aria-hidden="true"
          className="parking-jam-vehicle__wheel parking-jam-vehicle__wheel--a"
        />
        <span
          aria-hidden="true"
          className="parking-jam-vehicle__wheel parking-jam-vehicle__wheel--b"
        />
        <span
          aria-hidden="true"
          className="parking-jam-vehicle__wheel parking-jam-vehicle__wheel--c"
        />
        <span
          aria-hidden="true"
          className="parking-jam-vehicle__wheel parking-jam-vehicle__wheel--d"
        />
      </button>
      {selected && !disabled
        ? directions.map((direction) => (
            <button
              key={direction}
              type="button"
              aria-label={`${direction === "left" ? "左" : direction === "right" ? "右" : direction === "up" ? "上" : "下"}へ出庫`}
              className={`parking-jam-vehicle__direction parking-jam-vehicle__direction--${direction}`}
              onClick={() => onDirection(direction)}
            >
              <span
                aria-hidden="true"
                className="parking-jam-vehicle__chevron"
              />
            </button>
          ))
        : null}
    </div>
  );
}

export const _private = { getSwipeDirection };
