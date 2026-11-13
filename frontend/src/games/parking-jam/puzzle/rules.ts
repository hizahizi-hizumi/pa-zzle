import type {
  ParkingJamBoard,
  ParkingJamCell,
  ParkingJamDirection,
  ParkingJamMove,
  ParkingJamRoadOpening,
  ParkingJamState,
  ParkingJamVehicle,
  ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import {
  listParkingJamFixedAreaCells,
  listParkingJamVehicleCells,
} from "@/games/parking-jam/puzzle/board";

export type ParkingJamMoveBlocker =
  | { kind: "invalid-direction" }
  | { kind: "wall" }
  | { kind: "fixed-area"; cell: ParkingJamCell }
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

function openingContainsOffset(
  opening: ParkingJamRoadOpening,
  offset: number,
): boolean {
  return (
    opening.startOffset <= offset &&
    offset < opening.startOffset + opening.length
  );
}

/** 通るマスを、車に近い順に返す。 */
export function listParkingJamExitPathCells(
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

  const hasRoadOpening = board.roadOpenings.some(
    (opening) =>
      opening.side === move.direction &&
      openingContainsOffset(opening, exitOffset(vehicle)),
  );
  if (!hasRoadOpening) return [{ kind: "wall" }];

  const path = listParkingJamExitPathCells(board, vehicle, move.direction);
  const blockers: ParkingJamMoveBlocker[] = [];
  for (const area of board.fixedAreas) {
    const blockingCell = listParkingJamFixedAreaCells(area).find((cell) =>
      path.some((pathCell) => sameCell(pathCell, cell)),
    );
    if (blockingCell) blockers.push({ kind: "fixed-area", cell: blockingCell });
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

/**
 * 出られない手で、出られないわけとして示すもの。
 * - `wall`: 進む先の外周が、その車線で道路につながっていない。途中に何があっても、これを先に示す。
 * - `fixed-area` / `vehicle`: 車線は道路につながっているが、途中で最初に当たる植え込みのマスか車。
 */
export type ParkingJamExitContact = {
  blocker:
    | { kind: "wall" }
    | { kind: "fixed-area"; cell: ParkingJamCell }
    | { kind: "vehicle"; vehicleId: ParkingJamVehicleId };
  /** 示すものまでのマスの数。`wall` では、外周までのマスの数。 */
  freeCellCount: number;
};

/** 判定と優先は `listParkingJamMoveBlockers` と同じにする。 */
export function findParkingJamExitContact(
  board: ParkingJamBoard,
  state: ParkingJamState,
  move: ParkingJamMove,
): ParkingJamExitContact | null {
  const blockers = listParkingJamMoveBlockers(board, state, move);
  const vehicle = board.vehicles.find(({ id }) => id === move.vehicleId);
  if (
    !vehicle ||
    blockers.length === 0 ||
    blockers.some(({ kind }) => kind === "invalid-direction")
  ) {
    return null;
  }
  if (blockers.some(({ kind }) => kind === "wall")) {
    return {
      blocker: { kind: "wall" },
      freeCellCount: listParkingJamExitPathCells(board, vehicle, move.direction)
        .length,
    };
  }
  const { target, freeCellCount } = findFirstObstacle(
    board,
    state,
    vehicle,
    move.direction,
  );
  return { blocker: target, freeCellCount };
}

/** 途中に何も無ければ外周を返す。 */
function findFirstObstacle(
  board: ParkingJamBoard,
  state: ParkingJamState,
  vehicle: ParkingJamVehicle,
  direction: ParkingJamDirection,
): Pick<ParkingJamCollision, "target" | "freeCellCount"> {
  const path = listParkingJamExitPathCells(board, vehicle, direction);
  for (const [index, cell] of path.entries()) {
    const fixedArea = board.fixedAreas.some((area) =>
      listParkingJamFixedAreaCells(area).some((areaCell) =>
        sameCell(areaCell, cell),
      ),
    );
    if (fixedArea) {
      return { target: { kind: "fixed-area", cell }, freeCellCount: index };
    }
    const other = board.vehicles.find(
      (candidate) =>
        candidate.id !== vehicle.id &&
        state.remainingVehicleIds.includes(candidate.id) &&
        listParkingJamVehicleCells(candidate).some((candidateCell) =>
          sameCell(candidateCell, cell),
        ),
    );
    if (other) {
      return {
        target: { kind: "vehicle", vehicleId: other.id },
        freeCellCount: index,
      };
    }
  }
  return { target: { kind: "wall" }, freeCellCount: path.length };
}

/**
 * 出られない手で、車が進んで最初にぶつかるもの。出られないわけ（`findParkingJamExitContact`）と違い、
 * 道路につながっていない車線でも、途中に車か植え込みがあれば先にそれへぶつかる。
 */
export type ParkingJamCollision = {
  target: ParkingJamExitContact["blocker"];
  /** ぶつかるものまでのマスの数。`wall` では、外周までのマスの数。 */
  freeCellCount: number;
};

export function findParkingJamCollision(
  board: ParkingJamBoard,
  state: ParkingJamState,
  move: ParkingJamMove,
): ParkingJamCollision | null {
  const contact = findParkingJamExitContact(board, state, move);
  const vehicle = board.vehicles.find(({ id }) => id === move.vehicleId);
  if (!contact || !vehicle) {
    return null;
  }
  return findFirstObstacle(board, state, vehicle, move.direction);
}
