import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
} from "react";
import { PARKING_JAM_DISPLAY_NAME } from "@/games/parking-jam/display-name";

import type { ParkingJamOperation } from "@/games/parking-jam/play/use-parking-jam-play";
import type {
  ParkingJamBoard as ParkingJamBoardDefinition,
  ParkingJamDirection,
  ParkingJamState,
  ParkingJamVehicle,
  ParkingJamVehicleId,
  ParkingJamMove,
} from "@/games/parking-jam/puzzle/board";
import { ParkingJamBoardDefs } from "@/games/parking-jam/ui/board/ParkingJamBoardDefs";
import { ParkingJamCar } from "@/games/parking-jam/ui/board/ParkingJamCar";
import {
  getParkingJamDirectionControls,
  ParkingJamDirectionMark,
} from "@/games/parking-jam/ui/board/ParkingJamDirectionMark";
import { ParkingJamExitTrail } from "@/games/parking-jam/ui/board/ParkingJamExitTrail";
import { ParkingJamLot } from "@/games/parking-jam/ui/board/ParkingJamLot";
import {
  PARKING_JAM_CELL,
  PARKING_JAM_MARGIN,
  parkingJamBoardGeometry,
} from "@/games/parking-jam/ui/board/parking-jam-board-geometry";
import { useParkingJamBoardPaint } from "@/games/parking-jam/ui/board/parking-jam-board-paint";
import { listParkingJamMoveBlockers } from "@/games/parking-jam/puzzle/rules";
import { playAnimations } from "@/lib/motion";

import "@/games/parking-jam/ui/board/parking-jam-board.css";

export type ParkingJamBoardConcept = "original" | "plan";

type ParkingJamBoardProps = {
  concept?: ParkingJamBoardConcept;
  plannedMoves?: readonly ParkingJamMove[];
  board: ParkingJamBoardDefinition;
  state: ParkingJamState;
  selectedVehicleId: ParkingJamVehicleId | null;
  operation: ParkingJamOperation | null;
  interactionDisabled: boolean;
  /** 最後の車が出ていく演出の間だけ `true`。 */
  clearing: boolean;
  onSelectVehicle: (vehicleId: ParkingJamVehicleId) => void;
  onMove: (
    vehicleId: ParkingJamVehicleId,
    direction: ParkingJamDirection,
  ) => void;
  onClearAnimationComplete: () => void;
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
  concept = "original",
  plannedMoves = [],
  state,
  selectedVehicleId,
  operation,
  interactionDisabled,
  clearing,
  onSelectVehicle,
  onMove,
  onClearAnimationComplete,
}: ParkingJamBoardProps) {
  const pointerStart = useRef<{
    vehicleId: string;
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  const release = useRef<{
    vehicleId: string;
    direction: ParkingJamDirection;
    x: string;
    y: string;
  } | null>(null);
  const remaining = new Set(state.remainingVehicleIds);
  const width = board.width * PARKING_JAM_CELL;
  const height = board.height * PARKING_JAM_CELL;
  const paint = useParkingJamBoardPaint();
  const selectedVehicle = board.vehicles.find(
    (vehicle) => vehicle.id === selectedVehicleId && remaining.has(vehicle.id),
  );
  const exitingCarRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!clearing) {
      return;
    }

    return playAnimations({
      // 出ていく動きは CSS アニメーションなので、要素に付いた Animation を待つ。
      animate: () => exitingCarRef.current?.getAnimations?.() ?? [],
      // 出ていき終えたらすぐ結果へ進める。動きを減らす設定の CSS は 1ms で出ていき終える。
      completion: { type: "after-animations", holdMs: 0 },
      reducedMotionHoldMs: 0,
      unanimatedHoldMs: 0,
      onFinished: onClearAnimationComplete,
    });
  }, [clearing, onClearAnimationComplete]);

  function handlePointerDown(
    event: PointerEvent<SVGGElement>,
    vehicle: ParkingJamVehicle,
  ) {
    if (interactionDisabled) return;
    pointerStart.current = {
      vehicleId: vehicle.id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (concept !== "original") {
      event.currentTarget.classList.add("parking-jam-car--dragging");
    }
  }

  function handlePointerMove(
    event: PointerEvent<SVGGElement>,
    vehicle: ParkingJamVehicle,
  ) {
    const start = pointerStart.current;
    if (
      !start ||
      start.pointerId !== event.pointerId ||
      start.vehicleId !== vehicle.id ||
      concept === "original" ||
      interactionDisabled
    )
      return;

    const delta =
      vehicle.orientation === "horizontal"
        ? event.clientX - start.x
        : event.clientY - start.y;
    const scale =
      Math.hypot(
        event.currentTarget.ownerSVGElement?.getScreenCTM?.()?.a ?? 1,
        event.currentTarget.ownerSVGElement?.getScreenCTM?.()?.b ?? 0,
      ) || 1;
    const direction = getSwipeDirection(
      vehicle,
      event.clientX - start.x,
      event.clientY - start.y,
    );
    const legal = direction
      ? listParkingJamMoveBlockers(board, state, {
          vehicleId: vehicle.id,
          direction,
        }).length === 0
      : false;
    const limit = legal ? PARKING_JAM_CELL * 0.82 : PARKING_JAM_CELL * 0.16;
    const movement = Math.max(-limit, Math.min(limit, delta / scale));
    event.currentTarget.style.setProperty(
      "--parking-jam-drag-x",
      `${vehicle.orientation === "horizontal" ? movement : 0}px`,
    );
    event.currentTarget.style.setProperty(
      "--parking-jam-drag-y",
      `${vehicle.orientation === "vertical" ? movement : 0}px`,
    );
  }

  function resetPointer(event: PointerEvent<SVGGElement>) {
    if (pointerStart.current?.pointerId !== event.pointerId) return;
    pointerStart.current = null;
    event.currentTarget.classList.remove("parking-jam-car--dragging");
    event.currentTarget.style.removeProperty("--parking-jam-drag-x");
    event.currentTarget.style.removeProperty("--parking-jam-drag-y");
  }

  function handlePointerUp(
    event: PointerEvent<SVGGElement>,
    vehicle: ParkingJamVehicle,
  ) {
    const start = pointerStart.current;
    const x = event.currentTarget.style.getPropertyValue("--parking-jam-drag-x");
    const y = event.currentTarget.style.getPropertyValue("--parking-jam-drag-y");
    resetPointer(event);
    if (!start || start.vehicleId !== vehicle.id || interactionDisabled) return;
    const direction = getSwipeDirection(
      vehicle,
      event.clientX - start.x,
      event.clientY - start.y,
    );
    if (direction) {
      release.current = { vehicleId: vehicle.id, direction, x, y };
      onMove(vehicle.id, direction);
    }
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
      aria-label={`${PARKING_JAM_DISPLAY_NAME}盤面`}
      viewBox={`${-PARKING_JAM_MARGIN} ${-PARKING_JAM_MARGIN} ${width + PARKING_JAM_MARGIN * 2} ${height + PARKING_JAM_MARGIN * 2}`}
      className={`parking-jam-board parking-jam-board--${concept}`}
    >
      <ParkingJamBoardDefs board={board} paint={paint} />
      <ParkingJamLot board={board} paint={paint} />
      {concept !== "original" && operation?.type === "exited" ? (
        <ParkingJamExitTrail
          board={board}
          vehicle={board.vehicles.find((vehicle) => vehicle.id === operation.vehicleId)!}
          direction={operation.direction}
        />
      ) : null}
      {concept !== "original" && operation?.type === "exited" ? (
        <g key={operation.id} clipPath={paint.vehicleSpaceClipPath}>
          {board.vehicles
            .filter((vehicle) => vehicle.id === operation.vehicleId)
            .map((vehicle) => (
              <rect
                key={vehicle.id}
                x={vehicle.column * PARKING_JAM_CELL + 7}
                y={vehicle.row * PARKING_JAM_CELL + 7}
                width={
                  (vehicle.orientation === "horizontal" ? vehicle.length : 1) *
                    PARKING_JAM_CELL -
                  14
                }
                height={
                  (vehicle.orientation === "vertical" ? vehicle.length : 1) *
                    PARKING_JAM_CELL -
                  14
                }
                rx="13"
                className="parking-jam-board__freed-space"
              />
            ))}
        </g>
      ) : null}
      <g clipPath={paint.vehicleSpaceClipPath}>
        {board.vehicles.map((vehicle) => {
          const isRemaining = remaining.has(vehicle.id);
          const targeted = operation?.vehicleId === vehicle.id;
          const exiting = targeted && operation?.type === "exited";
          if (!isRemaining && !exiting) return null;
          const selected = selectedVehicleId === vehicle.id;
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
                "--parking-jam-exit-start-x":
                  concept !== "original" &&
                  release.current?.vehicleId === vehicle.id &&
                  release.current.direction === operation?.direction
                    ? release.current.x
                    : "0px",
                "--parking-jam-exit-start-y":
                  concept !== "original" &&
                  release.current?.vehicleId === vehicle.id &&
                  release.current.direction === operation?.direction
                    ? release.current.y
                    : "0px",
              } as CSSProperties)
            : undefined;
          return (
            <g
              key={targeted ? `${vehicle.id}-${operation?.id}` : vehicle.id}
              ref={exiting ? exitingCarRef : undefined}
              role="button"
              data-length={vehicle.length}
              tabIndex={interactionDisabled || exiting ? -1 : 0}
              aria-label={getVehicleLabel(vehicle)}
              aria-pressed={selected}
              className={`parking-jam-car${selected ? " parking-jam-car--selected" : ""}${feedbackClass}`}
              style={exitStyle}
              onPointerDown={(event) => handlePointerDown(event, vehicle)}
              onPointerMove={(event) => handlePointerMove(event, vehicle)}
              onPointerCancel={resetPointer}
              onPointerUp={(event) => handlePointerUp(event, vehicle)}
              onKeyDown={(event) => handleKeyDown(event, vehicle)}
            >
              <ParkingJamCar vehicle={vehicle} glassFill={paint.glassFill} />
            </g>
          );
        })}
      </g>
      {plannedMoves.map((move, index) => {
        const vehicle = board.vehicles.find((candidate) => candidate.id === move.vehicleId);
        if (!vehicle || !remaining.has(vehicle.id)) return null;
        return (
          <g key={`planned-${vehicle.id}`} className="parking-jam-board__plan-number" aria-hidden="true">
            <circle cx={(vehicle.column + 0.25) * PARKING_JAM_CELL} cy={(vehicle.row + 0.25) * PARKING_JAM_CELL} r="19" />
            <text x={(vehicle.column + 0.25) * PARKING_JAM_CELL} y={(vehicle.row + 0.25) * PARKING_JAM_CELL} textAnchor="middle" dominantBaseline="central">{index + 1}</text>
          </g>
        );
      })}
      {selectedVehicle && !interactionDisabled
        ? getParkingJamDirectionControls(selectedVehicle).map((control) => (
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
              <ParkingJamDirectionMark control={control} />
            </g>
          ))
        : null}
    </svg>
  );
}

export const _private = { getSwipeDirection };
