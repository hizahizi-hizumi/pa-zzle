export const PARKING_JAM_VEHICLE_LENGTHS = [2, 3] as const;

export type ParkingJamVehicleLength =
  (typeof PARKING_JAM_VEHICLE_LENGTHS)[number];
export type ParkingJamOrientation = "horizontal" | "vertical";
export type ParkingJamDirection = "up" | "right" | "down" | "left";
export type ParkingJamSide = ParkingJamDirection;
export type ParkingJamVehicleId = string;

export type ParkingJamCell = {
  row: number;
  column: number;
};

export type ParkingJamVehicle = ParkingJamCell & {
  id: ParkingJamVehicleId;
  orientation: ParkingJamOrientation;
  length: ParkingJamVehicleLength;
};

export type ParkingJamRoadOpening = {
  side: ParkingJamSide;
  startOffset: number;
  length: number;
};

export type ParkingJamFixedArea = ParkingJamCell & {
  width: number;
  height: number;
};

export type ParkingJamBoard = {
  width: number;
  height: number;
  vehicles: readonly ParkingJamVehicle[];
  fixedAreas: readonly ParkingJamFixedArea[];
  roadOpenings: readonly ParkingJamRoadOpening[];
};

export type ParkingJamState = {
  remainingVehicleIds: readonly ParkingJamVehicleId[];
};

export type ParkingJamMove = {
  vehicleId: ParkingJamVehicleId;
  direction: ParkingJamDirection;
};

export function createParkingJamInitialState(
  board: ParkingJamBoard,
): ParkingJamState {
  return { remainingVehicleIds: board.vehicles.map((vehicle) => vehicle.id) };
}

export function isParkingJamCleared(state: ParkingJamState): boolean {
  return state.remainingVehicleIds.length === 0;
}

export function listParkingJamVehicleCells(
  vehicle: ParkingJamVehicle,
): ParkingJamCell[] {
  return Array.from({ length: vehicle.length }, (_, offset) => ({
    row: vehicle.row + (vehicle.orientation === "vertical" ? offset : 0),
    column:
      vehicle.column + (vehicle.orientation === "horizontal" ? offset : 0),
  }));
}

export function listParkingJamFixedAreaCells(
  area: ParkingJamFixedArea,
): ParkingJamCell[] {
  return Array.from({ length: area.width * area.height }, (_, offset) => ({
    row: area.row + Math.floor(offset / area.width),
    column: area.column + (offset % area.width),
  }));
}

function cellKey(cell: ParkingJamCell): string {
  return `${cell.row}:${cell.column}`;
}

function validateBoardDimension(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 2) {
    throw new RangeError(`${name} must be an integer of at least 2`);
  }
}

function validatePositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function validateCellInsideBoard(
  cell: ParkingJamCell,
  board: ParkingJamBoard,
  description: string,
): void {
  if (!Number.isInteger(cell.row) || !Number.isInteger(cell.column)) {
    throw new RangeError(`${description} must use integer cell coordinates`);
  }
  if (
    cell.row < 0 ||
    cell.row >= board.height ||
    cell.column < 0 ||
    cell.column >= board.width
  ) {
    throw new RangeError(`${description} is outside the board`);
  }
}

function validateVehicles(board: ParkingJamBoard, occupied: Set<string>): void {
  const vehicleIds = new Set<string>();
  for (const vehicle of board.vehicles) {
    if (vehicleIds.has(vehicle.id)) {
      throw new Error(`Duplicate parking jam vehicle id: ${vehicle.id}`);
    }
    vehicleIds.add(vehicle.id);

    if (!PARKING_JAM_VEHICLE_LENGTHS.includes(vehicle.length)) {
      throw new RangeError(
        `Unsupported parking jam vehicle length: ${vehicle.length}`,
      );
    }

    for (const cell of listParkingJamVehicleCells(vehicle)) {
      validateCellInsideBoard(cell, board, `Parking jam vehicle ${vehicle.id}`);
      const key = cellKey(cell);
      if (occupied.has(key)) {
        throw new Error(`Parking jam vehicles overlap at ${key}`);
      }
      occupied.add(key);
    }
  }
}

function validateFixedAreas(
  board: ParkingJamBoard,
  occupied: Set<string>,
): void {
  for (const area of board.fixedAreas) {
    validatePositiveInteger(area.width, "Parking jam fixed area width");
    validatePositiveInteger(area.height, "Parking jam fixed area height");

    for (const cell of listParkingJamFixedAreaCells(area)) {
      validateCellInsideBoard(cell, board, "Parking jam fixed area");
      const key = cellKey(cell);
      if (occupied.has(key)) {
        throw new Error(`Parking jam fixed area overlaps at ${key}`);
      }
      occupied.add(key);
    }
  }
}

function openingLimit(board: ParkingJamBoard, side: ParkingJamSide): number {
  return side === "left" || side === "right" ? board.height : board.width;
}

function openingsOverlapOrTouch(
  left: ParkingJamRoadOpening,
  right: ParkingJamRoadOpening,
): boolean {
  if (left.side !== right.side) return false;
  const leftEnd = left.startOffset + left.length;
  const rightEnd = right.startOffset + right.length;
  return left.startOffset <= rightEnd && right.startOffset <= leftEnd;
}

function validateRoadOpenings(board: ParkingJamBoard): void {
  const validated: ParkingJamRoadOpening[] = [];
  for (const opening of board.roadOpenings) {
    validatePositiveInteger(opening.length, "Parking jam road opening length");
    if (
      !Number.isInteger(opening.startOffset) ||
      opening.startOffset < 0 ||
      opening.startOffset + opening.length > openingLimit(board, opening.side)
    ) {
      throw new RangeError(
        `Parking jam road opening is outside the board: ${opening.side}:${opening.startOffset}+${opening.length}`,
      );
    }

    if (
      validated.some((candidate) => openingsOverlapOrTouch(candidate, opening))
    ) {
      throw new Error(
        `Parking jam road openings overlap or touch on ${opening.side}`,
      );
    }
    validated.push(opening);
  }
}

export function validateParkingJamBoard(board: ParkingJamBoard): void {
  validateBoardDimension(board.width, "width");
  validateBoardDimension(board.height, "height");

  const occupied = new Set<string>();
  validateVehicles(board, occupied);
  validateFixedAreas(board, occupied);
  validateRoadOpenings(board);
}
