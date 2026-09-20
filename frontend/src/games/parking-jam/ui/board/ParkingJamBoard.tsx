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

type ParkingJamVehicleVisualType = "short" | "long";

type ParkingJamCarPalette = {
  body: string;
  roof: string;
  highlight: string;
  accent: string;
};

type ParkingJamCarPanel = {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
};

type ParkingJamCarVisualSpec = {
  frontGlassPath: string;
  rearGlassPath: string;
  roofPanel: ParkingJamCarPanel;
  seamPaths: readonly string[];
};

const PARKING_JAM_CAR_PALETTES: Record<
  ParkingJamVehicleVisualType,
  ParkingJamCarPalette
> = {
  short: {
    body: "#d46e67",
    roof: "#ed948a",
    highlight: "rgb(255 255 255 / 0.18)",
    accent: "#8d3934",
  },
  long: {
    body: "#617b95",
    roof: "#7f9bb7",
    highlight: "rgb(255 255 255 / 0.16)",
    accent: "#41566c",
  },
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

function getVehicleVisualType(
  vehicle: ParkingJamVehicle,
): ParkingJamVehicleVisualType {
  return vehicle.length === 3 ? "long" : "short";
}

function getVehiclePalette(vehicle: ParkingJamVehicle): ParkingJamCarPalette {
  return PARKING_JAM_CAR_PALETTES[getVehicleVisualType(vehicle)];
}

function getVehicleVisualSpec(
  vehicle: ParkingJamVehicle,
  x: number,
  y: number,
  vehicleWidth: number,
  vehicleHeight: number,
  facingPositive: boolean,
): ParkingJamCarVisualSpec {
  const horizontal = vehicle.orientation === "horizontal";
  const longBody = getVehicleVisualType(vehicle) === "long";
  const hoodLength = longBody ? 22 : 30;
  const frontGlassDepth = longBody ? 23 : 25;
  const rearDeckLength = longBody ? 15 : 24;
  const rearGlassDepth = longBody ? 18 : 20;
  const cabinInset = longBody ? 13 : 15;
  const glassEdgeInset = longBody ? 20 : 22;

  if (horizontal) {
    const start = x;
    const end = x + vehicleWidth;
    const crossStart = y;
    const crossEnd = y + vehicleHeight;
    const frontGlassFront = facingPositive
      ? end - hoodLength
      : start + hoodLength;
    const frontGlassRear = facingPositive
      ? frontGlassFront - frontGlassDepth
      : frontGlassFront + frontGlassDepth;
    const rearGlassRear = facingPositive
      ? start + rearDeckLength
      : end - rearDeckLength;
    const rearGlassFront = facingPositive
      ? rearGlassRear + rearGlassDepth
      : rearGlassRear - rearGlassDepth;
    const roofStart = Math.min(frontGlassRear, rearGlassFront);
    const roofEnd = Math.max(frontGlassRear, rearGlassFront);

    const frontGlassPath = facingPositive
      ? `M ${frontGlassRear} ${crossStart + cabinInset} L ${frontGlassFront} ${crossStart + glassEdgeInset} L ${frontGlassFront} ${crossEnd - glassEdgeInset} L ${frontGlassRear} ${crossEnd - cabinInset} Z`
      : `M ${frontGlassFront} ${crossStart + glassEdgeInset} L ${frontGlassRear} ${crossStart + cabinInset} L ${frontGlassRear} ${crossEnd - cabinInset} L ${frontGlassFront} ${crossEnd - glassEdgeInset} Z`;
    const rearGlassPath = facingPositive
      ? `M ${rearGlassRear} ${crossStart + glassEdgeInset} L ${rearGlassFront} ${crossStart + cabinInset} L ${rearGlassFront} ${crossEnd - cabinInset} L ${rearGlassRear} ${crossEnd - glassEdgeInset} Z`
      : `M ${rearGlassFront} ${crossStart + cabinInset} L ${rearGlassRear} ${crossStart + glassEdgeInset} L ${rearGlassRear} ${crossEnd - glassEdgeInset} L ${rearGlassFront} ${crossEnd - cabinInset} Z`;

    return {
      frontGlassPath,
      rearGlassPath,
      roofPanel: {
        x: roofStart - 1,
        y: y + cabinInset - 2,
        width: roofEnd - roofStart + 2,
        height: vehicleHeight - (cabinInset - 2) * 2,
        rx: longBody ? 11 : 13,
      },
      seamPaths: facingPositive
        ? [
            `M ${end - hoodLength * 0.45} ${y + 10} V ${y + vehicleHeight - 10}`,
            `M ${start + rearDeckLength * 0.5} ${y + 12} V ${y + vehicleHeight - 12}`,
          ]
        : [
            `M ${start + hoodLength * 0.45} ${y + 10} V ${y + vehicleHeight - 10}`,
            `M ${end - rearDeckLength * 0.5} ${y + 12} V ${y + vehicleHeight - 12}`,
          ],
    };
  }

  const start = y;
  const end = y + vehicleHeight;
  const crossStart = x;
  const crossEnd = x + vehicleWidth;
  const frontGlassFront = facingPositive
    ? end - hoodLength
    : start + hoodLength;
  const frontGlassRear = facingPositive
    ? frontGlassFront - frontGlassDepth
    : frontGlassFront + frontGlassDepth;
  const rearGlassRear = facingPositive
    ? start + rearDeckLength
    : end - rearDeckLength;
  const rearGlassFront = facingPositive
    ? rearGlassRear + rearGlassDepth
    : rearGlassRear - rearGlassDepth;
  const roofStart = Math.min(frontGlassRear, rearGlassFront);
  const roofEnd = Math.max(frontGlassRear, rearGlassFront);

  const frontGlassPath = facingPositive
    ? `M ${crossStart + cabinInset} ${frontGlassRear} L ${crossStart + glassEdgeInset} ${frontGlassFront} L ${crossEnd - glassEdgeInset} ${frontGlassFront} L ${crossEnd - cabinInset} ${frontGlassRear} Z`
    : `M ${crossStart + glassEdgeInset} ${frontGlassFront} L ${crossStart + cabinInset} ${frontGlassRear} L ${crossEnd - cabinInset} ${frontGlassRear} L ${crossEnd - glassEdgeInset} ${frontGlassFront} Z`;
  const rearGlassPath = facingPositive
    ? `M ${crossStart + glassEdgeInset} ${rearGlassRear} L ${crossStart + cabinInset} ${rearGlassFront} L ${crossEnd - cabinInset} ${rearGlassFront} L ${crossEnd - glassEdgeInset} ${rearGlassRear} Z`
    : `M ${crossStart + cabinInset} ${rearGlassFront} L ${crossStart + glassEdgeInset} ${rearGlassRear} L ${crossEnd - glassEdgeInset} ${rearGlassRear} L ${crossEnd - cabinInset} ${rearGlassFront} Z`;

  return {
    frontGlassPath,
    rearGlassPath,
    roofPanel: {
      x: x + cabinInset - 2,
      y: roofStart - 1,
      width: vehicleWidth - (cabinInset - 2) * 2,
      height: roofEnd - roofStart + 2,
      rx: longBody ? 11 : 13,
    },
    seamPaths: facingPositive
      ? [
          `M ${x + 10} ${end - hoodLength * 0.45} H ${x + vehicleWidth - 10}`,
          `M ${x + 12} ${start + rearDeckLength * 0.5} H ${x + vehicleWidth - 12}`,
        ]
      : [
          `M ${x + 10} ${start + hoodLength * 0.45} H ${x + vehicleWidth - 10}`,
          `M ${x + 12} ${end - rearDeckLength * 0.5} H ${x + vehicleWidth - 12}`,
        ],
  };
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
        <clipPath id="parking-jam-vehicle-space">
          <rect width={width} height={height} />
          {board.roadOpenings.map((opening) => {
            const geometry = parkingJamBoardGeometry.getAccessRoadGeometry(
              opening,
              board,
            );
            return (
              <rect
                key={`clip-${opening.side}-${opening.startOffset}-${opening.length}`}
                {...geometry}
              />
            );
          })}
        </clipPath>
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
        </g>
      ))}
      <g clipPath="url(#parking-jam-vehicle-space)">
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
          const frontY = horizontal
            ? null
            : facingPositive
              ? y + vehicleHeight - 7
              : y + 7;
          const palette = getVehiclePalette(vehicle);
          const visualSpec = getVehicleVisualSpec(
            vehicle,
            x,
            y,
            vehicleWidth,
            vehicleHeight,
            facingPositive,
          );
          const wheelOffsetStart = vehicle.length >= 3 ? 0.14 : 0.18;
          const wheelOffsetEnd = vehicle.length >= 3 ? 0.72 : 0.64;
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
          const exitStyle = {
            "--parking-jam-car-body": palette.body,
            "--parking-jam-car-roof": palette.roof,
            "--parking-jam-car-highlight": palette.highlight,
            "--parking-jam-car-accent": palette.accent,
            ...(exitTranslation
              ? {
                  "--parking-jam-exit-x": `${exitTranslation.x}px`,
                  "--parking-jam-exit-y": `${exitTranslation.y}px`,
                }
              : {}),
          } as CSSProperties;
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
              <rect
                x={visualSpec.roofPanel.x}
                y={visualSpec.roofPanel.y}
                width={visualSpec.roofPanel.width}
                height={visualSpec.roofPanel.height}
                rx={visualSpec.roofPanel.rx}
                className="parking-jam-car__roof-panel"
              />
              <path
                d={visualSpec.frontGlassPath}
                className="parking-jam-car__glass"
              />
              <path
                d={visualSpec.rearGlassPath}
                className="parking-jam-car__rear-glass"
              />
              {visualSpec.seamPaths.map((seamPath) => (
                <path
                  key={seamPath}
                  d={seamPath}
                  className="parking-jam-car__detail"
                />
              ))}
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
              {horizontal ? (
                <>
                  <rect
                    x={x + vehicleWidth * wheelOffsetStart}
                    y={y - 3}
                    width={vehicleWidth * 0.18}
                    height="7"
                    rx="3.5"
                    className="parking-jam-car__wheel"
                  />
                  <rect
                    x={x + vehicleWidth * wheelOffsetEnd}
                    y={y - 3}
                    width={vehicleWidth * 0.18}
                    height="7"
                    rx="3.5"
                    className="parking-jam-car__wheel"
                  />
                  <rect
                    x={x + vehicleWidth * wheelOffsetStart}
                    y={y + vehicleHeight - 4}
                    width={vehicleWidth * 0.18}
                    height="7"
                    rx="3.5"
                    className="parking-jam-car__wheel"
                  />
                  <rect
                    x={x + vehicleWidth * wheelOffsetEnd}
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
                    y={y + vehicleHeight * wheelOffsetStart}
                    width="7"
                    height={vehicleHeight * 0.18}
                    rx="3.5"
                    className="parking-jam-car__wheel"
                  />
                  <rect
                    x={x - 3}
                    y={y + vehicleHeight * wheelOffsetEnd}
                    width="7"
                    height={vehicleHeight * 0.18}
                    rx="3.5"
                    className="parking-jam-car__wheel"
                  />
                  <rect
                    x={x + vehicleWidth - 4}
                    y={y + vehicleHeight * wheelOffsetStart}
                    width="7"
                    height={vehicleHeight * 0.18}
                    rx="3.5"
                    className="parking-jam-car__wheel"
                  />
                  <rect
                    x={x + vehicleWidth - 4}
                    y={y + vehicleHeight * wheelOffsetEnd}
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
      </g>
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
