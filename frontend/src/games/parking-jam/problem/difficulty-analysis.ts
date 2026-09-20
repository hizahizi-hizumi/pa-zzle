import {
  createParkingJamInitialState,
  type ParkingJamBoard,
  type ParkingJamDirection,
  type ParkingJamVehicleId,
} from "../puzzle/board";
import {
  listParkingJamLegalMoves,
  listParkingJamMoveBlockers,
} from "../puzzle/rules";
export const PARKING_JAM_MAXIMUM_EXACT_ORDER_VEHICLE_COUNT = 16;

type ParkingJamExitPath = {
  direction: ParkingJamDirection;
  blockerMask: number;
};

export type ParkingJamDifficultyFeatures = {
  dependencyDepth: number;
  initialLegalVehicleCount: number;
  initialLegalVehicleRatio: number;
  vehicleBlockingEdgeCount: number;
  availableExitDirectionCount: number;
  initialBlockedExitDirectionCount: number;
  initialBlockedExitDirectionRatio: number;
  legalOrderCount: string | null;
  solutionOrderFreedom: number | null;
};

export type ParkingJamDifficultyAnalysis = {
  status: "supported" | "unsupported";
  features: ParkingJamDifficultyFeatures;
};

const directions: readonly ParkingJamDirection[] = [
  "up",
  "right",
  "down",
  "left",
];

function factorial(value: number): number {
  let result = 1;
  for (let factor = 2; factor <= value; factor += 1) result *= factor;
  return result;
}

function countVehicleBlockingEdges(board: ParkingJamBoard): {
  availableExitDirectionCount: number;
  initialBlockedExitDirectionCount: number;
  vehicleBlockingEdgeCount: number;
} {
  const state = createParkingJamInitialState(board);
  let availableExitDirectionCount = 0;
  let initialBlockedExitDirectionCount = 0;
  let vehicleBlockingEdgeCount = 0;

  for (const vehicle of board.vehicles) {
    for (const direction of directions) {
      const blockers = listParkingJamMoveBlockers(board, state, {
        vehicleId: vehicle.id,
        direction,
      });
      if (
        blockers.some(
          ({ kind }) =>
            kind === "invalid-direction" ||
            kind === "wall" ||
            kind === "fixed-area",
        )
      ) {
        continue;
      }

      availableExitDirectionCount += 1;
      const vehicleBlockers = blockers.filter(
        (blocker) => blocker.kind === "vehicle",
      );
      if (vehicleBlockers.length > 0) initialBlockedExitDirectionCount += 1;
      vehicleBlockingEdgeCount += vehicleBlockers.length;
    }
  }

  return {
    availableExitDirectionCount,
    initialBlockedExitDirectionCount,
    vehicleBlockingEdgeCount,
  };
}

function createExitPathsByVehicle(
  board: ParkingJamBoard,
): Map<ParkingJamVehicleId, readonly ParkingJamExitPath[]> {
  const state = createParkingJamInitialState(board);
  const vehicleIndex = new Map(
    board.vehicles.map((vehicle, index) => [vehicle.id, index]),
  );
  const result = new Map<ParkingJamVehicleId, readonly ParkingJamExitPath[]>();

  for (const vehicle of board.vehicles) {
    const paths: ParkingJamExitPath[] = [];
    for (const direction of directions) {
      const blockers = listParkingJamMoveBlockers(board, state, {
        vehicleId: vehicle.id,
        direction,
      });
      if (
        blockers.some(
          ({ kind }) =>
            kind === "invalid-direction" ||
            kind === "wall" ||
            kind === "fixed-area",
        )
      ) {
        continue;
      }

      let blockerMask = 0;
      for (const blocker of blockers) {
        if (blocker.kind !== "vehicle") continue;
        const index = vehicleIndex.get(blocker.vehicleId);
        if (index !== undefined) blockerMask |= 1 << index;
      }
      paths.push({ direction, blockerMask });
    }
    result.set(vehicle.id, paths);
  }

  return result;
}

function countLegalVehicleOrders(board: ParkingJamBoard): bigint | null {
  if (board.vehicles.length > PARKING_JAM_MAXIMUM_EXACT_ORDER_VEHICLE_COUNT) {
    return null;
  }

  const pathsByVehicle = createExitPathsByVehicle(board);
  const memo = new Map<number, bigint>([[0, 1n]]);

  function count(remainingMask: number): bigint {
    const cached = memo.get(remainingMask);
    if (cached !== undefined) return cached;

    let total = 0n;
    for (let index = 0; index < board.vehicles.length; index += 1) {
      const vehicleBit = 1 << index;
      if ((remainingMask & vehicleBit) === 0) continue;
      const vehicle = board.vehicles[index];
      if (!vehicle) continue;
      const paths = pathsByVehicle.get(vehicle.id) ?? [];
      const canExit = paths.some(
        ({ blockerMask }) => (blockerMask & remainingMask) === 0,
      );
      if (canExit) total += count(remainingMask & ~vehicleBit);
    }

    memo.set(remainingMask, total);
    return total;
  }

  return count((1 << board.vehicles.length) - 1);
}

function calculateOrderFreedom(
  vehicleCount: number,
  legalOrderCount: bigint | null,
): number | null {
  if (legalOrderCount === null) return null;
  if (vehicleCount <= 1) return 1;
  const maximumOrderCount = factorial(vehicleCount);
  if (maximumOrderCount <= 1) return 1;
  return Math.log(Number(legalOrderCount)) / Math.log(maximumOrderCount);
}

export function analyzeParkingJamDifficulty(
  board: ParkingJamBoard,
  solvabilityAnalysis: {
    removalLayers: readonly (readonly ParkingJamVehicleId[])[];
  },
): ParkingJamDifficultyAnalysis {
  const state = createParkingJamInitialState(board);
  const initialLegalVehicleIds = new Set(
    listParkingJamLegalMoves(board, state).map((move) => move.vehicleId),
  );
  const blockers = countVehicleBlockingEdges(board);
  const legalOrderCount = countLegalVehicleOrders(board);
  const vehicleCount = board.vehicles.length;
  const features: ParkingJamDifficultyFeatures = {
    dependencyDepth: solvabilityAnalysis.removalLayers.length,
    initialLegalVehicleCount: initialLegalVehicleIds.size,
    initialLegalVehicleRatio:
      vehicleCount === 0 ? 1 : initialLegalVehicleIds.size / vehicleCount,
    vehicleBlockingEdgeCount: blockers.vehicleBlockingEdgeCount,
    availableExitDirectionCount: blockers.availableExitDirectionCount,
    initialBlockedExitDirectionCount: blockers.initialBlockedExitDirectionCount,
    initialBlockedExitDirectionRatio:
      blockers.availableExitDirectionCount === 0
        ? 0
        : blockers.initialBlockedExitDirectionCount /
          blockers.availableExitDirectionCount,
    legalOrderCount: legalOrderCount?.toString() ?? null,
    solutionOrderFreedom: calculateOrderFreedom(vehicleCount, legalOrderCount),
  };

  return {
    status: legalOrderCount === null ? "unsupported" : "supported",
    features,
  };
}

export const _private = {
  countLegalVehicleOrders,
};
