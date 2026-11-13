import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { PARKING_JAM_DISPLAY_NAME } from "@/games/parking-jam/display-name";

import type { ParkingJamOperation } from "@/games/parking-jam/play/use-parking-jam-play";
import {
  listParkingJamFixedAreaCells,
  type ParkingJamBoard as ParkingJamBoardDefinition,
  type ParkingJamDirection,
  type ParkingJamMove,
  type ParkingJamState,
  type ParkingJamVehicle,
  type ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import {
  findParkingJamCollision,
  type ParkingJamCollision,
} from "@/games/parking-jam/puzzle/rules";
import { ParkingJamBoardDefs } from "@/games/parking-jam/ui/board/ParkingJamBoardDefs";
import { ParkingJamCar } from "@/games/parking-jam/ui/board/ParkingJamCar";
import {
  getParkingJamDirectionControls,
  ParkingJamDirectionMark,
} from "@/games/parking-jam/ui/board/ParkingJamDirectionMark";
import {
  getParkingJamFixedAreaKey,
  PARKING_JAM_FINALE_LINE_SELECTOR,
  ParkingJamLot,
} from "@/games/parking-jam/ui/board/ParkingJamLot";
import {
  PARKING_JAM_CELL,
  PARKING_JAM_MARGIN,
  parkingJamBoardGeometry,
} from "@/games/parking-jam/ui/board/parking-jam-board-geometry";
import {
  playParkingJamCollision,
  playParkingJamExit,
  playParkingJamFinale,
  playParkingJamStruck,
  resetParkingJamCar,
} from "@/games/parking-jam/ui/board/parking-jam-board-motion";
import { useParkingJamBoardPaint } from "@/games/parking-jam/ui/board/parking-jam-board-paint";
import { playAnimations, prefersReducedMotion } from "@/lib/motion";

import "@/games/parking-jam/ui/board/parking-jam-board.css";

type ParkingJamBoardProps = {
  board: ParkingJamBoardDefinition;
  state: ParkingJamState;
  selectedVehicleId: ParkingJamVehicleId | null;
  operation: ParkingJamOperation | null;
  interactionDisabled: boolean;
  /** 最後の車が出ていき、空いた駐車場を見せる演出の間だけ `true`。 */
  clearing: boolean;
  onSelectVehicle: (vehicleId: ParkingJamVehicleId) => void;
  onMove: (
    vehicleId: ParkingJamVehicleId,
    direction: ParkingJamDirection,
  ) => void;
  onClearAnimationComplete: () => void;
  /** 盤面に残っていない車を、`delayMs` だけ待ってからそれぞれの向きへ出ていかせる。 */
  departures?: readonly ParkingJamDeparture[];
};

export type ParkingJamDeparture = ParkingJamMove & { delayMs: number };

/** 出ていく動きを始めた車。盤面に戻されるまで、盤面の外に置いたまま描き続ける。 */
type ExitedCars = {
  board: ParkingJamBoardDefinition;
  vehicleIds: ReadonlySet<ParkingJamVehicleId>;
};

const SWIPE_THRESHOLD = 18;

const boardKeys = new WeakMap<ParkingJamBoardDefinition, number>();
let nextBoardKey = 0;

/** 別の問題の車を、前の問題の車の要素と動きを引き継がずに描くための鍵。 */
function getBoardKey(board: ParkingJamBoardDefinition): number {
  const known = boardKeys.get(board);
  if (known !== undefined) {
    return known;
  }
  const key = nextBoardKey++;
  boardKeys.set(board, key);
  return key;
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

function getBlockedCollision(
  board: ParkingJamBoardDefinition,
  state: ParkingJamState,
  operation: ParkingJamOperation | null,
): ParkingJamCollision | null {
  return operation?.type === "blocked"
    ? findParkingJamCollision(board, state, operation)
    : null;
}

function getVehicleCenter(vehicle: ParkingJamVehicle): {
  x: number;
  y: number;
} {
  const horizontal = vehicle.orientation === "horizontal";
  return {
    x:
      (vehicle.column + (horizontal ? vehicle.length : 1) / 2) *
      PARKING_JAM_CELL,
    y: (vehicle.row + (horizontal ? 1 : vehicle.length) / 2) * PARKING_JAM_CELL,
  };
}

function getLineCenter(line: Element): { x: number; y: number } {
  const read = (name: string) => Number(line.getAttribute(name) ?? 0);
  return {
    x: (read("x1") + read("x2")) / 2,
    y: (read("y1") + read("y2")) / 2,
  };
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
  departures = [],
}: ParkingJamBoardProps) {
  const pointerStart = useRef<{
    vehicleId: string;
    x: number;
    y: number;
  } | null>(null);
  const pressedDirection = useRef<ParkingJamDirection | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const directionControlsRef = useRef<SVGGElement>(null);
  const carElements = useRef(new Map<ParkingJamVehicleId, SVGGElement>());
  const animatedOperation = useRef<ParkingJamOperation | null>(null);
  const [exitedCars, setExitedCars] = useState<ExitedCars>({
    board,
    vehicleIds: new Set(),
  });
  const exitedVehicleIds =
    exitedCars.board === board ? exitedCars.vehicleIds : new Set<string>();
  const remaining = new Set(state.remainingVehicleIds);
  const width = board.width * PARKING_JAM_CELL;
  const height = board.height * PARKING_JAM_CELL;
  const paint = useParkingJamBoardPaint();
  const selectedVehicle = board.vehicles.find(
    (vehicle) => vehicle.id === selectedVehicleId && remaining.has(vehicle.id),
  );
  const collision = getBlockedCollision(board, state, operation);
  const blockedVehicle =
    operation?.type === "blocked"
      ? board.vehicles.find(({ id }) => id === operation.vehicleId)
      : undefined;
  const roadlessCurb =
    blockedVehicle && operation && collision?.roadless
      ? parkingJamBoardGeometry.getLaneCurbLine(
          board,
          blockedVehicle,
          operation.direction,
        )
      : null;

  // 車の動きは、途中で次の操作が来ても今見えている位置から続けるため、要素を作り直さずに Web Animations で動かす。
  useLayoutEffect(() => {
    if (!operation || animatedOperation.current === operation) {
      return;
    }
    animatedOperation.current = operation;
    const vehicle = board.vehicles.find(({ id }) => id === operation.vehicleId);
    if (!vehicle || prefersReducedMotion()) {
      return;
    }
    const car = carElements.current.get(vehicle.id);
    if (operation.type === "exited") {
      playParkingJamExit(
        car,
        parkingJamBoardGeometry.getVehicleExitTranslation(
          board,
          vehicle,
          operation.direction,
        ),
      );
      setExitedCars((current) => ({
        board,
        vehicleIds: new Set([
          ...(current.board === board ? current.vehicleIds : []),
          vehicle.id,
        ]),
      }));
      return;
    }
    const hit = findParkingJamCollision(board, state, operation);
    if (!hit) {
      return;
    }
    const hitTranslation =
      parkingJamBoardGeometry.getVehicleCollisionTranslation(
        operation.direction,
        hit,
      );
    playParkingJamCollision(car, operation.direction, hitTranslation);
    if (operation.vehicleId === selectedVehicleId) {
      playParkingJamCollision(
        directionControlsRef.current,
        operation.direction,
        hitTranslation,
      );
    }
    const { target } = hit;
    if (target.kind === "vehicle") {
      playParkingJamStruck(
        carElements.current.get(target.vehicleId),
        operation.direction,
      );
    } else if (target.kind === "fixed-area") {
      const area = board.fixedAreas.find((candidate) =>
        listParkingJamFixedAreaCells(candidate).some(
          (cell) =>
            cell.row === target.cell.row && cell.column === target.cell.column,
        ),
      );
      if (area) {
        playParkingJamStruck(
          svgRef.current?.querySelector(
            `[data-parking-jam-fixed-area="${getParkingJamFixedAreaKey(area)}"]`,
          ),
          operation.direction,
        );
      }
    }
  }, [operation, board, state, selectedVehicleId]);

  // 待った・盤面を戻すで戻ってきた車を、元の位置に置き直す。
  useLayoutEffect(() => {
    const returned = [...exitedVehicleIds].filter((id) =>
      state.remainingVehicleIds.includes(id),
    );
    if (returned.length === 0) {
      return;
    }
    for (const id of returned) {
      resetParkingJamCar(carElements.current.get(id));
    }
    setExitedCars((current) => ({
      board: current.board,
      vehicleIds: new Set(
        [...current.vehicleIds].filter((id) => !returned.includes(id)),
      ),
    }));
  }, [exitedVehicleIds, state]);

  const playFinale = useEffectEvent((): Animation[] => {
    const lastVehicle = board.vehicles.find(
      ({ id }) => id === operation?.vehicleId,
    );
    const origin = lastVehicle
      ? getVehicleCenter(lastVehicle)
      : { x: width / 2, y: height / 2 };
    const lines = [
      ...(svgRef.current?.querySelectorAll(PARKING_JAM_FINALE_LINE_SELECTOR) ??
        []),
    ];
    return playParkingJamFinale(
      lines.map((element) => {
        const center = getLineCenter(element);
        return {
          element,
          distance: Math.hypot(center.x - origin.x, center.y - origin.y),
        };
      }),
    );
  });

  useEffect(() => {
    if (!clearing) {
      return;
    }

    return playAnimations({
      animate: playFinale,
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
      ref={svgRef}
      role="group"
      aria-label={`${PARKING_JAM_DISPLAY_NAME}盤面`}
      viewBox={`${-PARKING_JAM_MARGIN} ${-PARKING_JAM_MARGIN} ${width + PARKING_JAM_MARGIN * 2} ${height + PARKING_JAM_MARGIN * 2}`}
      className="parking-jam-board"
    >
      <ParkingJamBoardDefs board={board} paint={paint} />
      <ParkingJamLot board={board} paint={paint} />
      {roadlessCurb && operation ? (
        <line
          key={`roadless-${operation.id}`}
          {...roadlessCurb}
          className="parking-jam-board__roadless-curb"
        />
      ) : null}
      <g key={getBoardKey(board)} clipPath={paint.vehicleSpaceClipPath}>
        {board.vehicles.map((vehicle) => {
          const isRemaining = remaining.has(vehicle.id);
          const targeted = operation?.vehicleId === vehicle.id;
          const exiting =
            targeted && operation?.type === "exited" && !prefersReducedMotion();
          const departure = isRemaining
            ? undefined
            : departures.find(({ vehicleId }) => vehicleId === vehicle.id);
          if (
            !isRemaining &&
            !exiting &&
            !exitedVehicleIds.has(vehicle.id) &&
            !departure
          )
            return null;
          const selected = selectedVehicleId === vehicle.id;
          const feedbackClass = departure
            ? ` parking-jam-car--depart-${departure.direction}`
            : targeted && operation
              ? ` parking-jam-car--${operation.type === "exited" ? "exit" : "blocked"}-${operation.direction}`
              : "";
          const departureTranslation = departure
            ? parkingJamBoardGeometry.getVehicleExitTranslation(
                board,
                vehicle,
                departure.direction,
              )
            : null;
          const departureStyle =
            departure && departureTranslation
              ? ({
                  "--parking-jam-exit-x": `${departureTranslation.x}px`,
                  "--parking-jam-exit-y": `${departureTranslation.y}px`,
                  animationDelay: `${departure.delayMs}ms`,
                  animationFillMode: "both",
                } as CSSProperties)
              : undefined;
          return (
            <g
              key={vehicle.id}
              ref={(element) => {
                if (element) {
                  carElements.current.set(vehicle.id, element);
                } else {
                  carElements.current.delete(vehicle.id);
                }
              }}
              role="button"
              tabIndex={interactionDisabled || !isRemaining ? -1 : 0}
              aria-label={getVehicleLabel(vehicle)}
              aria-pressed={selected}
              className={`parking-jam-car${selected ? " parking-jam-car--selected" : ""}${feedbackClass}`}
              style={departureStyle}
              onPointerDown={(event) => handlePointerDown(event, vehicle)}
              onPointerUp={(event) => handlePointerUp(event, vehicle)}
              onKeyDown={(event) => handleKeyDown(event, vehicle)}
            >
              <ParkingJamCar vehicle={vehicle} glassFill={paint.glassFill} />
            </g>
          );
        })}
      </g>
      <g ref={directionControlsRef}>
        {selectedVehicle && !interactionDisabled
          ? getParkingJamDirectionControls(selectedVehicle).map((control) => (
              <g
                key={`direction-${selectedVehicle.id}-${control.direction}`}
                role="button"
                tabIndex={0}
                aria-label={`${getDirectionLabel(control.direction)}へ出庫`}
                className="parking-jam-direction-control"
                onPointerDown={() => {
                  pressedDirection.current = control.direction;
                }}
                onClick={(event) => {
                  const pressed = pressedDirection.current;
                  pressedDirection.current = null;
                  // 押せる範囲は車の上にも広がるので、車を押して選んだ指を離したときのクリックが、
                  // 選んで現れた方向の操作に届く。この操作の上で押し始めたクリックだけを受ける。
                  // 押し始めの無いクリック（detail が 0）は、指やマウスによらない操作として受ける。
                  if (event.detail !== 0 && pressed !== control.direction) {
                    return;
                  }
                  onMove(selectedVehicle.id, control.direction);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onMove(selectedVehicle.id, control.direction);
                  }
                }}
              >
                <rect
                  {...control.hitArea}
                  className="parking-jam-direction-control__hit"
                />
                <ParkingJamDirectionMark control={control} />
              </g>
            ))
          : null}
      </g>
    </svg>
  );
}

export const _private = { getSwipeDirection };
