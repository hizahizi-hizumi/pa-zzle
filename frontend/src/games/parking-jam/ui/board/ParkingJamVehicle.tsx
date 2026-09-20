import type { AnimationEvent, CSSProperties } from "react";

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
  onExitAnimationComplete?: () => void;
};

const vehicleColorClassNames = [
  "bg-cyan-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-violet-400",
  "bg-emerald-400",
  "bg-orange-400",
  "bg-sky-400",
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
  onExitAnimationComplete,
}: ParkingJamVehicleProps) {
  const colorClassName =
    vehicleColorClassNames[colorIndex % vehicleColorClassNames.length] ??
    vehicleColorClassNames[0];
  const feedbackClassName = getFeedbackClassName(feedback, feedbackDirection);

  function handleAnimationEnd(event: AnimationEvent<HTMLButtonElement>) {
    if (
      event.target === event.currentTarget &&
      feedback === "exiting" &&
      onExitAnimationComplete
    ) {
      onExitAnimationComplete();
    }
  }

  return (
    <button
      type="button"
      aria-label={getVehicleLabel(vehicle)}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      onAnimationEnd={handleAnimationEnd}
      className={`absolute z-20 rounded-xl p-1 outline-none transition-[filter,box-shadow] focus-visible:ring-4 focus-visible:ring-white/90 disabled:pointer-events-none ${
        selected
          ? "ring-4 ring-white shadow-lg brightness-110"
          : "hover:brightness-105"
      } ${feedbackClassName}`}
      style={getVehicleStyle({ vehicle, boardWidth, boardHeight })}
    >
      <span
        className={`relative flex size-full items-center justify-center overflow-hidden rounded-lg shadow-sm ${colorClassName}`}
      >
        <span className="absolute inset-[18%] rounded-md bg-slate-950/25" />
        <span
          className={`absolute rounded-full bg-white/55 ${
            vehicle.orientation === "horizontal"
              ? "left-[24%] right-[24%] top-1/2 h-1 -translate-y-1/2"
              : "bottom-[24%] top-[24%] left-1/2 w-1 -translate-x-1/2"
          }`}
        />
      </span>
    </button>
  );
}
