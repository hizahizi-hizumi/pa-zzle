import type { CSSProperties } from "react";

import type { ParkingJamVehicle } from "@/games/parking-jam/puzzle/board";
import { PARKING_JAM_CELL } from "@/games/parking-jam/ui/board/parking-jam-board-geometry";

type ParkingJamCarProps = {
  vehicle: ParkingJamVehicle;
  glassFill: string;
};

function isVehicleFacingPositiveDirection(vehicle: ParkingJamVehicle): boolean {
  const idWeight = [...vehicle.id].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );
  return idWeight % 2 === 0;
}

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
  hoodPanelPath: string | null;
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
  const hoodLength = longBody ? 22 : 46;
  const glassDepth = longBody ? 23 : 24;
  const rearDeckLength = longBody ? 15 : 24;
  const glassOuterEndInset = longBody ? 14 : 15;
  const glassInnerEndInset = longBody ? 18 : 20;
  const cabinInset = longBody ? 13 : 15;

  if (horizontal) {
    const start = x;
    const end = x + vehicleWidth;
    const crossStart = y;
    const crossEnd = y + vehicleHeight;
    const frontGlassFront = facingPositive
      ? end - hoodLength
      : start + hoodLength;
    const frontGlassRear = facingPositive
      ? frontGlassFront - glassDepth
      : frontGlassFront + glassDepth;
    const rearGlassRear = facingPositive
      ? start + rearDeckLength
      : end - rearDeckLength;
    const rearGlassFront = facingPositive
      ? rearGlassRear + glassDepth
      : rearGlassRear - glassDepth;
    const roofStart = Math.min(frontGlassRear, rearGlassFront);
    const roofEnd = Math.max(frontGlassRear, rearGlassFront);

    const frontGlassPath = facingPositive
      ? `M ${frontGlassRear} ${crossStart + glassInnerEndInset} L ${frontGlassFront} ${crossStart + glassOuterEndInset} L ${frontGlassFront} ${crossEnd - glassOuterEndInset} L ${frontGlassRear} ${crossEnd - glassInnerEndInset} Z`
      : `M ${frontGlassFront} ${crossStart + glassOuterEndInset} L ${frontGlassRear} ${crossStart + glassInnerEndInset} L ${frontGlassRear} ${crossEnd - glassInnerEndInset} L ${frontGlassFront} ${crossEnd - glassOuterEndInset} Z`;
    const rearGlassPath = facingPositive
      ? `M ${rearGlassRear} ${crossStart + glassOuterEndInset} L ${rearGlassFront} ${crossStart + glassInnerEndInset} L ${rearGlassFront} ${crossEnd - glassInnerEndInset} L ${rearGlassRear} ${crossEnd - glassOuterEndInset} Z`
      : `M ${rearGlassFront} ${crossStart + glassInnerEndInset} L ${rearGlassRear} ${crossStart + glassOuterEndInset} L ${rearGlassRear} ${crossEnd - glassOuterEndInset} L ${rearGlassFront} ${crossEnd - glassInnerEndInset} Z`;
    const hoodPanelPath = longBody
      ? null
      : facingPositive
        ? `M ${frontGlassFront + 4} ${y + 10} L ${end - 24} ${y + 13} L ${end - 24} ${y + vehicleHeight - 13} L ${frontGlassFront + 4} ${y + vehicleHeight - 10} Z`
        : `M ${x + 24} ${y + 13} L ${frontGlassFront - 4} ${y + 10} L ${frontGlassFront - 4} ${y + vehicleHeight - 10} L ${x + 24} ${y + vehicleHeight - 13} Z`;

    return {
      frontGlassPath,
      rearGlassPath,
      hoodPanelPath,
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
    ? frontGlassFront - glassDepth
    : frontGlassFront + glassDepth;
  const rearGlassRear = facingPositive
    ? start + rearDeckLength
    : end - rearDeckLength;
  const rearGlassFront = facingPositive
    ? rearGlassRear + glassDepth
    : rearGlassRear - glassDepth;
  const roofStart = Math.min(frontGlassRear, rearGlassFront);
  const roofEnd = Math.max(frontGlassRear, rearGlassFront);

  const frontGlassPath = facingPositive
    ? `M ${crossStart + glassInnerEndInset} ${frontGlassRear} L ${crossStart + glassOuterEndInset} ${frontGlassFront} L ${crossEnd - glassOuterEndInset} ${frontGlassFront} L ${crossEnd - glassInnerEndInset} ${frontGlassRear} Z`
    : `M ${crossStart + glassOuterEndInset} ${frontGlassFront} L ${crossStart + glassInnerEndInset} ${frontGlassRear} L ${crossEnd - glassInnerEndInset} ${frontGlassRear} L ${crossEnd - glassOuterEndInset} ${frontGlassFront} Z`;
  const rearGlassPath = facingPositive
    ? `M ${crossStart + glassOuterEndInset} ${rearGlassRear} L ${crossStart + glassInnerEndInset} ${rearGlassFront} L ${crossEnd - glassInnerEndInset} ${rearGlassFront} L ${crossEnd - glassOuterEndInset} ${rearGlassRear} Z`
    : `M ${crossStart + glassInnerEndInset} ${rearGlassFront} L ${crossStart + glassOuterEndInset} ${rearGlassRear} L ${crossEnd - glassOuterEndInset} ${rearGlassRear} L ${crossEnd - glassInnerEndInset} ${rearGlassFront} Z`;
  const hoodPanelPath = longBody
    ? null
    : facingPositive
      ? `M ${x + 10} ${frontGlassFront + 4} L ${x + 13} ${end - 24} L ${x + vehicleWidth - 13} ${end - 24} L ${x + vehicleWidth - 10} ${frontGlassFront + 4} Z`
      : `M ${x + 13} ${y + 24} L ${x + 10} ${frontGlassFront - 4} L ${x + vehicleWidth - 10} ${frontGlassFront - 4} L ${x + vehicleWidth - 13} ${y + 24} Z`;

  return {
    frontGlassPath,
    rearGlassPath,
    hoodPanelPath,
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

export function ParkingJamCar({ vehicle, glassFill }: ParkingJamCarProps) {
  const horizontal = vehicle.orientation === "horizontal";
  const vehicleWidth =
    (horizontal ? vehicle.length : 1) * PARKING_JAM_CELL - 20;
  const vehicleHeight =
    (horizontal ? 1 : vehicle.length) * PARKING_JAM_CELL - 20;
  const x = vehicle.column * PARKING_JAM_CELL + 10;
  const y = vehicle.row * PARKING_JAM_CELL + 10;
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
  const paletteStyle = {
    "--parking-jam-car-body": palette.body,
    "--parking-jam-car-roof": palette.roof,
    "--parking-jam-car-highlight": palette.highlight,
    "--parking-jam-car-accent": palette.accent,
  } as CSSProperties;

  return (
    <g style={paletteStyle}>
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
      {visualSpec.hoodPanelPath ? (
        <path
          d={visualSpec.hoodPanelPath}
          className="parking-jam-car__hood-panel"
        />
      ) : null}
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
        fill={glassFill}
        className="parking-jam-car__glass"
      />
      <path
        d={visualSpec.rearGlassPath}
        fill={glassFill}
        className="parking-jam-car__rear-glass"
      />
      {visualSpec.seamPaths.map((seamPath) => (
        <path key={seamPath} d={seamPath} className="parking-jam-car__detail" />
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
}
