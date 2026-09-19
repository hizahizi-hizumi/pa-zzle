export const PARKING_JAM_MAX_BOARD_SIZE = 8;
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

export type ParkingJamExit = {
  side: ParkingJamSide;
  offset: number;
};

export type ParkingJamBoard = {
  width: number;
  height: number;
  vehicles: readonly ParkingJamVehicle[];
  obstacles: readonly ParkingJamCell[];
  exits: readonly ParkingJamExit[];
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

function cellKey(cell: ParkingJamCell): string {
  return `${cell.row}:${cell.column}`;
}

function validateBoardSize(value: number, name: string): void {
  if (
    !Number.isInteger(value) ||
    value < 2 ||
    value > PARKING_JAM_MAX_BOARD_SIZE
  ) {
    throw new RangeError(
      `${name} must be an integer between 2 and ${PARKING_JAM_MAX_BOARD_SIZE}`,
    );
  }
}

export function validateParkingJamBoard(board: ParkingJamBoard): void {
  validateBoardSize(board.width, "width");
  validateBoardSize(board.height, "height");

  const occupied = new Set<string>();
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
      if (
        cell.row < 0 ||
        cell.row >= board.height ||
        cell.column < 0 ||
        cell.column >= board.width
      ) {
        throw new RangeError(
          `Parking jam vehicle ${vehicle.id} is outside the board`,
        );
      }
      const key = cellKey(cell);
      if (occupied.has(key)) {
        throw new Error(`Parking jam vehicles overlap at ${key}`);
      }
      occupied.add(key);
    }
  }

  for (const obstacle of board.obstacles) {
    if (
      obstacle.row < 0 ||
      obstacle.row >= board.height ||
      obstacle.column < 0 ||
      obstacle.column >= board.width
    ) {
      throw new RangeError("Parking jam obstacle is outside the board");
    }
    const key = cellKey(obstacle);
    if (occupied.has(key)) {
      throw new Error(`Parking jam obstacle overlaps a vehicle at ${key}`);
    }
    if (occupied.has(`obstacle:${key}`)) {
      throw new Error(`Duplicate parking jam obstacle at ${key}`);
    }
    occupied.add(`obstacle:${key}`);
  }

  const exitKeys = new Set<string>();
  for (const exit of board.exits) {
    const maximumOffset =
      exit.side === "left" || exit.side === "right"
        ? board.height
        : board.width;
    if (
      !Number.isInteger(exit.offset) ||
      exit.offset < 0 ||
      exit.offset >= maximumOffset
    ) {
      throw new RangeError(
        `Parking jam exit offset is outside the board: ${exit.side}:${exit.offset}`,
      );
    }
    const key = `${exit.side}:${exit.offset}`;
    if (exitKeys.has(key)) {
      throw new Error(`Duplicate parking jam exit: ${key}`);
    }
    exitKeys.add(key);
  }
}
