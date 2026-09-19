import type {
  ParkingJamBoard,
  ParkingJamCell,
  ParkingJamDirection,
  ParkingJamMove,
  ParkingJamState,
  ParkingJamVehicle,
  ParkingJamVehicleId,
} from "./board";
import { listParkingJamVehicleCells } from "./board";

export type ParkingJamMoveBlocker =
  | { kind: "invalid-direction" }
  | { kind: "wall" }
  | { kind: "obstacle"; cell: ParkingJamCell }
  | { kind: "vehicle"; vehicleId: ParkingJamVehicleId };

function vehicleSupportsDirection(
  vehicle: ParkingJamVehicle,
  direction: ParkingJamDirection,
): boolean {
  return vehicle.orientation === "horizontal"
    ? direction === "left" || direction === "right"
    : direction === "up" || direction === "down";
}

function exitOffset(vehicle: ParkingJamVehicle): number {
  return vehicle.orientation === "horizontal" ? vehicle.row : vehicle.column;
}

function pathCells(
  board: ParkingJamBoard,
  vehicle: ParkingJamVehicle,
  direction: ParkingJamDirection,
): ParkingJamCell[] {
  const cells: ParkingJamCell[] = [];
  if (direction === "left") {
    for (let column = vehicle.column - 1; column >= 0; column -= 1)
      cells.push({ row: vehicle.row, column });
  } else if (direction === "right") {
    for (
      let column = vehicle.column + vehicle.length;
      column < board.width;
      column += 1
    )
      cells.push({ row: vehicle.row, column });
  } else if (direction === "up") {
    for (let row = vehicle.row - 1; row >= 0; row -= 1)
      cells.push({ row, column: vehicle.column });
  } else {
    for (let row = vehicle.row + vehicle.length; row < board.height; row += 1)
      cells.push({ row, column: vehicle.column });
  }
  return cells;
}

function sameCell(left: ParkingJamCell, right: ParkingJamCell): boolean {
  return left.row === right.row && left.column === right.column;
}

export function listParkingJamMoveBlockers(
  board: ParkingJamBoard,
  state: ParkingJamState,
  move: ParkingJamMove,
): ParkingJamMoveBlocker[] {
  const vehicle = board.vehicles.find(
    (candidate) => candidate.id === move.vehicleId,
  );
  if (!vehicle || !state.remainingVehicleIds.includes(move.vehicleId))
    return [{ kind: "invalid-direction" }];
  if (!vehicleSupportsDirection(vehicle, move.direction))
    return [{ kind: "invalid-direction" }];

  const hasExit = board.exits.some(
    (exit) =>
      exit.side === move.direction && exit.offset === exitOffset(vehicle),
  );
  if (!hasExit) return [{ kind: "wall" }];

  const path = pathCells(board, vehicle, move.direction);
  const blockers: ParkingJamMoveBlocker[] = [];
  for (const obstacle of board.obstacles) {
    if (path.some((cell) => sameCell(cell, obstacle)))
      blockers.push({ kind: "obstacle", cell: obstacle });
  }

  for (const other of board.vehicles) {
    if (
      other.id === vehicle.id ||
      !state.remainingVehicleIds.includes(other.id)
    )
      continue;
    if (
      listParkingJamVehicleCells(other).some((cell) =>
        path.some((pathCell) => sameCell(pathCell, cell)),
      )
    ) {
      blockers.push({ kind: "vehicle", vehicleId: other.id });
    }
  }
  return blockers;
}

export function listParkingJamLegalMoves(
  board: ParkingJamBoard,
  state: ParkingJamState,
): ParkingJamMove[] {
  const directions: readonly ParkingJamDirection[] = [
    "up",
    "right",
    "down",
    "left",
  ];
  const moves: ParkingJamMove[] = [];
  for (const vehicleId of state.remainingVehicleIds) {
    for (const direction of directions) {
      const move = { vehicleId, direction };
      if (listParkingJamMoveBlockers(board, state, move).length === 0)
        moves.push(move);
    }
  }
  return moves;
}

export function applyParkingJamMove(
  board: ParkingJamBoard,
  state: ParkingJamState,
  move: ParkingJamMove,
): ParkingJamState | null {
  if (listParkingJamMoveBlockers(board, state, move).length > 0) return null;
  return {
    remainingVehicleIds: state.remainingVehicleIds.filter(
      (vehicleId) => vehicleId !== move.vehicleId,
    ),
  };
}
