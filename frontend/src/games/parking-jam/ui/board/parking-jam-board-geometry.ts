import type {
  ParkingJamBoard,
  ParkingJamDirection,
  ParkingJamRoadOpening,
  ParkingJamSide,
  ParkingJamVehicle,
} from "@/games/parking-jam/puzzle/board";

export const PARKING_JAM_CELL = 100;
export const PARKING_JAM_MARGIN = 90;

const PARKING_BAY_EDGE_INSET = 22;
const PARKING_BAY_DEPTH = 178;
const ROAD_OVERLAP = 10;
const ROAD_MARKING_INSET = 16;
const ROAD_MARKING_LOT_GAP = 18;

type LineGeometry = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type RectGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type AxisSegment = {
  start: number;
  end: number;
};

function getSideLength(board: ParkingJamBoard, side: ParkingJamSide): number {
  return (
    (side === "left" || side === "right" ? board.height : board.width) *
    PARKING_JAM_CELL
  );
}

function getOpeningSegment(opening: ParkingJamRoadOpening): AxisSegment {
  return {
    start: opening.startOffset * PARKING_JAM_CELL,
    end: (opening.startOffset + opening.length) * PARKING_JAM_CELL,
  };
}

function getCurbSegments(
  board: ParkingJamBoard,
  side: ParkingJamSide,
): AxisSegment[] {
  const openings = board.roadOpenings
    .filter((opening) => opening.side === side)
    .map(getOpeningSegment)
    .sort((left, right) => left.start - right.start);
  const segments: AxisSegment[] = [];
  let cursor = 0;

  for (const opening of openings) {
    if (cursor < opening.start) {
      segments.push({ start: cursor, end: opening.start });
    }
    cursor = opening.end;
  }

  const sideLength = getSideLength(board, side);
  if (cursor < sideLength) {
    segments.push({ start: cursor, end: sideLength });
  }

  return segments;
}

function getBoundaryCurbLines(board: ParkingJamBoard): LineGeometry[] {
  const width = board.width * PARKING_JAM_CELL;
  const height = board.height * PARKING_JAM_CELL;
  const lines: LineGeometry[] = [];

  for (const segment of getCurbSegments(board, "up")) {
    lines.push({ x1: segment.start, y1: 0, x2: segment.end, y2: 0 });
  }
  for (const segment of getCurbSegments(board, "right")) {
    lines.push({ x1: width, y1: segment.start, x2: width, y2: segment.end });
  }
  for (const segment of getCurbSegments(board, "down")) {
    lines.push({
      x1: segment.start,
      y1: height,
      x2: segment.end,
      y2: height,
    });
  }
  for (const segment of getCurbSegments(board, "left")) {
    lines.push({ x1: 0, y1: segment.start, x2: 0, y2: segment.end });
  }

  return lines;
}

function getAccessRoadGeometry(
  opening: ParkingJamRoadOpening,
  board: ParkingJamBoard,
): RectGeometry {
  const { start, end } = getOpeningSegment(opening);
  const length = end - start;
  const width = board.width * PARKING_JAM_CELL;
  const height = board.height * PARKING_JAM_CELL;

  if (opening.side === "up") {
    return {
      x: start,
      y: -PARKING_JAM_MARGIN,
      width: length,
      height: PARKING_JAM_MARGIN + ROAD_OVERLAP,
    };
  }
  if (opening.side === "down") {
    return {
      x: start,
      y: height - ROAD_OVERLAP,
      width: length,
      height: PARKING_JAM_MARGIN + ROAD_OVERLAP,
    };
  }
  if (opening.side === "left") {
    return {
      x: -PARKING_JAM_MARGIN,
      y: start,
      width: PARKING_JAM_MARGIN + ROAD_OVERLAP,
      height: length,
    };
  }
  return {
    x: width - ROAD_OVERLAP,
    y: start,
    width: PARKING_JAM_MARGIN + ROAD_OVERLAP,
    height: length,
  };
}

function getAccessRoadCurbLines(
  opening: ParkingJamRoadOpening,
  board: ParkingJamBoard,
): LineGeometry[] {
  const { start, end } = getOpeningSegment(opening);
  const width = board.width * PARKING_JAM_CELL;
  const height = board.height * PARKING_JAM_CELL;

  if (opening.side === "up") {
    return [
      { x1: start, y1: -PARKING_JAM_MARGIN, x2: start, y2: 0 },
      { x1: end, y1: -PARKING_JAM_MARGIN, x2: end, y2: 0 },
    ];
  }
  if (opening.side === "down") {
    return [
      { x1: start, y1: height, x2: start, y2: height + PARKING_JAM_MARGIN },
      { x1: end, y1: height, x2: end, y2: height + PARKING_JAM_MARGIN },
    ];
  }
  if (opening.side === "left") {
    return [
      { x1: -PARKING_JAM_MARGIN, y1: start, x2: 0, y2: start },
      { x1: -PARKING_JAM_MARGIN, y1: end, x2: 0, y2: end },
    ];
  }
  return [
    { x1: width, y1: start, x2: width + PARKING_JAM_MARGIN, y2: start },
    { x1: width, y1: end, x2: width + PARKING_JAM_MARGIN, y2: end },
  ];
}

function getAccessRoadCenterLine(
  opening: ParkingJamRoadOpening,
  board: ParkingJamBoard,
): LineGeometry {
  const { start, end } = getOpeningSegment(opening);
  const center = (start + end) / 2;
  const width = board.width * PARKING_JAM_CELL;
  const height = board.height * PARKING_JAM_CELL;

  if (opening.side === "up") {
    return {
      x1: center,
      y1: -PARKING_JAM_MARGIN + ROAD_MARKING_INSET,
      x2: center,
      y2: -ROAD_MARKING_LOT_GAP,
    };
  }
  if (opening.side === "down") {
    return {
      x1: center,
      y1: height + ROAD_MARKING_LOT_GAP,
      x2: center,
      y2: height + PARKING_JAM_MARGIN - ROAD_MARKING_INSET,
    };
  }
  if (opening.side === "left") {
    return {
      x1: -PARKING_JAM_MARGIN + ROAD_MARKING_INSET,
      y1: center,
      x2: -ROAD_MARKING_LOT_GAP,
      y2: center,
    };
  }
  return {
    x1: width + ROAD_MARKING_LOT_GAP,
    y1: center,
    x2: width + PARKING_JAM_MARGIN - ROAD_MARKING_INSET,
    y2: center,
  };
}

function isBayDividerInsideOpening(
  position: number,
  openings: readonly ParkingJamRoadOpening[],
): boolean {
  return openings.some((opening) => {
    const segment = getOpeningSegment(opening);
    return position >= segment.start && position <= segment.end;
  });
}

function getParkingBayLines(board: ParkingJamBoard): LineGeometry[] {
  const width = board.width * PARKING_JAM_CELL;
  const height = board.height * PARKING_JAM_CELL;
  const openingsBySide = {
    up: board.roadOpenings.filter((opening) => opening.side === "up"),
    right: board.roadOpenings.filter((opening) => opening.side === "right"),
    down: board.roadOpenings.filter((opening) => opening.side === "down"),
    left: board.roadOpenings.filter((opening) => opening.side === "left"),
  };
  const lines: LineGeometry[] = [];

  for (let column = 1; column < board.width; column += 1) {
    const x = column * PARKING_JAM_CELL;
    if (!isBayDividerInsideOpening(x, openingsBySide.up)) {
      lines.push({
        x1: x,
        y1: PARKING_BAY_EDGE_INSET,
        x2: x,
        y2: PARKING_BAY_DEPTH,
      });
    }
    if (!isBayDividerInsideOpening(x, openingsBySide.down)) {
      lines.push({
        x1: x,
        y1: height - PARKING_BAY_EDGE_INSET,
        x2: x,
        y2: height - PARKING_BAY_DEPTH,
      });
    }
  }

  for (let row = 2; row < board.height - 1; row += 1) {
    const y = row * PARKING_JAM_CELL;
    if (!isBayDividerInsideOpening(y, openingsBySide.left)) {
      lines.push({
        x1: PARKING_BAY_EDGE_INSET,
        y1: y,
        x2: PARKING_BAY_DEPTH,
        y2: y,
      });
    }
    if (!isBayDividerInsideOpening(y, openingsBySide.right)) {
      lines.push({
        x1: width - PARKING_BAY_EDGE_INSET,
        y1: y,
        x2: width - PARKING_BAY_DEPTH,
        y2: y,
      });
    }
  }

  return lines;
}

function getVehicleExitTranslation(
  board: ParkingJamBoard,
  vehicle: ParkingJamVehicle,
  direction: ParkingJamDirection,
): { x: number; y: number } {
  const horizontal = vehicle.orientation === "horizontal";
  const vehicleWidth =
    (horizontal ? vehicle.length : 1) * PARKING_JAM_CELL - 20;
  const vehicleHeight =
    (horizontal ? 1 : vehicle.length) * PARKING_JAM_CELL - 20;
  const x = vehicle.column * PARKING_JAM_CELL + 10;
  const y = vehicle.row * PARKING_JAM_CELL + 10;
  const boardWidth = board.width * PARKING_JAM_CELL;
  const boardHeight = board.height * PARKING_JAM_CELL;
  const outsidePadding = 24;

  if (direction === "left") {
    return {
      x: -(x + vehicleWidth + PARKING_JAM_MARGIN + outsidePadding),
      y: 0,
    };
  }
  if (direction === "right") {
    return {
      x: boardWidth + PARKING_JAM_MARGIN + outsidePadding - x,
      y: 0,
    };
  }
  if (direction === "up") {
    return {
      x: 0,
      y: -(y + vehicleHeight + PARKING_JAM_MARGIN + outsidePadding),
    };
  }
  return {
    x: 0,
    y: boardHeight + PARKING_JAM_MARGIN + outsidePadding - y,
  };
}

export const parkingJamBoardGeometry = {
  getAccessRoadCenterLine,
  getAccessRoadCurbLines,
  getAccessRoadGeometry,
  getBoundaryCurbLines,
  getParkingBayLines,
  getVehicleExitTranslation,
};

export const _private = {
  getCurbSegments,
  getOpeningSegment,
  isBayDividerInsideOpening,
};
