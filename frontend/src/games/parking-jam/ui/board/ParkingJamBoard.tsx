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
  ParkingJamMove,
  ParkingJamState,
  ParkingJamVehicle,
  ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import { findParkingJamExitContact } from "@/games/parking-jam/puzzle/rules";
import type {
  ParkingJamContactCue,
  ParkingJamVehicleCue,
} from "@/games/parking-jam/ui/board/board-cue";
import { ParkingJamBoardCues } from "@/games/parking-jam/ui/board/ParkingJamBoardCues";
import { ParkingJamBoardDefs } from "@/games/parking-jam/ui/board/ParkingJamBoardDefs";
import { ParkingJamCar } from "@/games/parking-jam/ui/board/ParkingJamCar";
import { getParkingJamBumpTranslation } from "@/games/parking-jam/ui/board/ParkingJamContactMark";
import {
  getParkingJamDirectionControls,
  ParkingJamDirectionMark,
} from "@/games/parking-jam/ui/board/ParkingJamDirectionMark";
import { ParkingJamLot } from "@/games/parking-jam/ui/board/ParkingJamLot";
import {
  PARKING_JAM_CELL,
  PARKING_JAM_MARGIN,
  parkingJamBoardGeometry,
} from "@/games/parking-jam/ui/board/parking-jam-board-geometry";
import { useParkingJamBoardPaint } from "@/games/parking-jam/ui/board/parking-jam-board-paint";
import { playAnimations } from "@/lib/motion";

import "@/games/parking-jam/ui/board/parking-jam-board.css";

type ParkingJamBoardProps = {
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
  /** 車に重ねる合図。チュートリアルで使う。 */
  cues?: readonly ParkingJamVehicleCue[];
  /** 出られない手で進む先と当たるものを示す合図。チュートリアルで使う。 */
  contacts?: readonly ParkingJamContactCue[];
  /**
   * 出られない手で、車を前の物に触れるまで進めてから戻す。渡さなければ本番と同じく、その場で小さく揺らす。
   * チュートリアルで、何に当たったかを動きでも見せるのに使う。
   */
  bumpsToContact?: boolean;
  /**
   * 盤面に残っていない車を、`delayMs` だけ待ってからそれぞれの向きへ出ていかせる。
   * チュートリアルの導入で、車が出ていって空になる駐車場をゴールとして見せるのに使う。
   */
  departures?: readonly ParkingJamDeparture[];
  /** 盤面に残っていない車の、停まっていた場所を点線で示す。`ghostDelayMs` だけ待ってから浮かび上がらせる。 */
  ghostVehicleIds?: readonly ParkingJamVehicleId[];
  ghostDelayMs?: number;
};

export type ParkingJamDeparture = ParkingJamMove & { delayMs: number };

const SWIPE_THRESHOLD = 18;

/** 前の物に触れるまで進めてから戻す、当たる動きの長さ。進む距離が長いほど長くする。 */
function getBumpDurationMs(freeCellCount: number): number {
  return 200 + 90 * freeCellCount;
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
  clearing,
  onSelectVehicle,
  onMove,
  onClearAnimationComplete,
  cues = [],
  contacts = [],
  bumpsToContact = false,
  departures = [],
  ghostVehicleIds = [],
  ghostDelayMs = 0,
}: ParkingJamBoardProps) {
  const pointerStart = useRef<{
    vehicleId: string;
    x: number;
    y: number;
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
      aria-label={`${PARKING_JAM_DISPLAY_NAME}盤面`}
      viewBox={`${-PARKING_JAM_MARGIN} ${-PARKING_JAM_MARGIN} ${width + PARKING_JAM_MARGIN * 2} ${height + PARKING_JAM_MARGIN * 2}`}
      className="parking-jam-board"
    >
      <ParkingJamBoardDefs board={board} paint={paint} />
      <ParkingJamLot board={board} paint={paint} />
      <g clipPath={paint.vehicleSpaceClipPath}>
        {board.vehicles.map((vehicle) => {
          const isRemaining = remaining.has(vehicle.id);
          const targeted = operation?.vehicleId === vehicle.id;
          const exiting = targeted && operation?.type === "exited";
          const departure = isRemaining
            ? undefined
            : departures.find(({ vehicleId }) => vehicleId === vehicle.id);
          if (!isRemaining && !exiting && !departure) return null;
          const selected = selectedVehicleId === vehicle.id;
          const exitDirection = exiting
            ? operation?.direction
            : departure?.direction;
          const bumpContact =
            bumpsToContact && targeted && operation?.type === "blocked"
              ? findParkingJamExitContact(board, state, operation)
              : null;
          const feedbackClass = bumpContact
            ? " parking-jam-car--bump"
            : exitDirection
              ? ` parking-jam-car--exit-${exitDirection}`
              : targeted && operation
                ? ` parking-jam-car--blocked-${operation.direction}`
                : "";
          const exitTranslation = exitDirection
            ? parkingJamBoardGeometry.getVehicleExitTranslation(
                board,
                vehicle,
                exitDirection,
              )
            : null;
          const bumpTranslation =
            bumpContact && operation
              ? getParkingJamBumpTranslation(operation.direction, bumpContact)
              : null;
          const exitStyle = exitTranslation
            ? ({
                "--parking-jam-exit-x": `${exitTranslation.x}px`,
                "--parking-jam-exit-y": `${exitTranslation.y}px`,
                ...(departure && {
                  animationDelay: `${departure.delayMs}ms`,
                  animationFillMode: "both",
                }),
              } as CSSProperties)
            : bumpTranslation && bumpContact
              ? ({
                  "--parking-jam-bump-x": `${bumpTranslation.x}px`,
                  "--parking-jam-bump-y": `${bumpTranslation.y}px`,
                  "--parking-jam-bump-duration": `${getBumpDurationMs(bumpContact.freeCellCount)}ms`,
                } as CSSProperties)
              : undefined;
          return (
            <g
              key={targeted ? `${vehicle.id}-${operation?.id}` : vehicle.id}
              ref={exiting ? exitingCarRef : undefined}
              role="button"
              tabIndex={interactionDisabled || !isRemaining ? -1 : 0}
              aria-label={getVehicleLabel(vehicle)}
              aria-pressed={selected}
              className={`parking-jam-car${selected ? " parking-jam-car--selected" : ""}${feedbackClass}`}
              style={exitStyle}
              onPointerDown={(event) => handlePointerDown(event, vehicle)}
              onPointerUp={(event) => handlePointerUp(event, vehicle)}
              onKeyDown={(event) => handleKeyDown(event, vehicle)}
            >
              <ParkingJamCar vehicle={vehicle} glassFill={paint.glassFill} />
            </g>
          );
        })}
      </g>
      <ParkingJamBoardCues
        board={board}
        remainingVehicleIds={state.remainingVehicleIds}
        cues={cues}
        contacts={contacts}
        ghostVehicleIds={ghostVehicleIds}
        ghostDelayMs={ghostDelayMs}
      />
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
