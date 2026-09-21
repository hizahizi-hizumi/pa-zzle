import {
  createParkingJamInitialState,
  listParkingJamVehicleCells,
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
  pathLength: number;
};

type ParkingJamOrderSpaceAnalysis = {
  legalOrderCount: bigint;
  reachableStateCount: number;
  averageLegalVehicleRatio: number;
  minimumLegalVehicleRatio: number;
  forcedChoiceStateRatio: number;
  averageLegalDirectionCount: number;
  averageNewlyUnlockedVehicleCount: number;
  maximumNewlyUnlockedVehicleCount: number;
  requiredPrecedenceCount: number;
  maximumRequiredPredecessorCount: number;
};

export type ParkingJamDifficultyFeatures = {
  dependencyDepth: number;
  initialLegalVehicleCount: number;
  initialLegalVehicleRatio: number;
  vehicleBlockingEdgeCount: number;
  maximumVehicleBlockingOutDegree: number;
  maximumVehicleBlockingInDegree: number;
  availableExitDirectionCount: number;
  initialBlockedExitDirectionCount: number;
  initialBlockedExitDirectionRatio: number;
  legalOrderCount: string | null;
  solutionOrderFreedom: number | null;
  reachableStateCount: number | null;
  averageLegalVehicleRatio: number | null;
  minimumLegalVehicleRatio: number | null;
  forcedChoiceStateRatio: number | null;
  averageLegalDirectionCount: number | null;
  averageNewlyUnlockedVehicleCount: number | null;
  maximumNewlyUnlockedVehicleCount: number | null;
  requiredPrecedenceCount: number | null;
  maximumRequiredPredecessorCount: number | null;
  vehicleCellOccupancyRatio: number;
  longVehicleRatio: number;
  roadOpeningCoverageRatio: number;
  averageExitPathLength: number;
  maximumExitPathLength: number;
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

function exitPathLength(
  board: ParkingJamBoard,
  vehicleId: ParkingJamVehicleId,
  direction: ParkingJamDirection,
): number {
  const vehicle = board.vehicles.find(
    (candidate) => candidate.id === vehicleId,
  );
  if (!vehicle) return 0;

  switch (direction) {
    case "left":
      return vehicle.column;
    case "right":
      return board.width - vehicle.column - vehicle.length;
    case "up":
      return vehicle.row;
    case "down":
      return board.height - vehicle.row - vehicle.length;
  }
}

function countVehicleBlockingEdges(board: ParkingJamBoard): {
  availableExitDirectionCount: number;
  initialBlockedExitDirectionCount: number;
  vehicleBlockingEdgeCount: number;
  maximumVehicleBlockingOutDegree: number;
  maximumVehicleBlockingInDegree: number;
} {
  const state = createParkingJamInitialState(board);
  let availableExitDirectionCount = 0;
  let initialBlockedExitDirectionCount = 0;
  let vehicleBlockingEdgeCount = 0;
  const blockedVehicleIdsByBlocker = new Map<
    ParkingJamVehicleId,
    Set<ParkingJamVehicleId>
  >();
  const blockerIdsByBlockedVehicle = new Map<
    ParkingJamVehicleId,
    Set<ParkingJamVehicleId>
  >();

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
      for (const blocker of vehicleBlockers) {
        const blockedVehicleIds =
          blockedVehicleIdsByBlocker.get(blocker.vehicleId) ?? new Set();
        blockedVehicleIds.add(vehicle.id);
        blockedVehicleIdsByBlocker.set(blocker.vehicleId, blockedVehicleIds);

        const blockerIds =
          blockerIdsByBlockedVehicle.get(vehicle.id) ?? new Set();
        blockerIds.add(blocker.vehicleId);
        blockerIdsByBlockedVehicle.set(vehicle.id, blockerIds);
      }
    }
  }

  return {
    availableExitDirectionCount,
    initialBlockedExitDirectionCount,
    vehicleBlockingEdgeCount,
    maximumVehicleBlockingOutDegree: Math.max(
      0,
      ...[...blockedVehicleIdsByBlocker.values()].map((ids) => ids.size),
    ),
    maximumVehicleBlockingInDegree: Math.max(
      0,
      ...[...blockerIdsByBlockedVehicle.values()].map((ids) => ids.size),
    ),
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
      paths.push({
        direction,
        blockerMask,
        pathLength: exitPathLength(board, vehicle.id, direction),
      });
    }
    result.set(vehicle.id, paths);
  }

  return result;
}

function listLegalVehicleOptions(
  board: ParkingJamBoard,
  pathsByVehicle: ReadonlyMap<
    ParkingJamVehicleId,
    readonly ParkingJamExitPath[]
  >,
  remainingMask: number,
): { vehicleIndex: number; legalDirectionCount: number }[] {
  const options: { vehicleIndex: number; legalDirectionCount: number }[] = [];
  for (let index = 0; index < board.vehicles.length; index += 1) {
    const vehicleBit = 1 << index;
    if ((remainingMask & vehicleBit) === 0) continue;
    const vehicle = board.vehicles[index];
    if (!vehicle) continue;
    const legalDirectionCount = (pathsByVehicle.get(vehicle.id) ?? []).filter(
      ({ blockerMask }) => (blockerMask & remainingMask) === 0,
    ).length;
    if (legalDirectionCount > 0)
      options.push({ vehicleIndex: index, legalDirectionCount });
  }
  return options;
}

function analyzeLegalOrderSpace(
  board: ParkingJamBoard,
): ParkingJamOrderSpaceAnalysis | null {
  if (board.vehicles.length > PARKING_JAM_MAXIMUM_EXACT_ORDER_VEHICLE_COUNT) {
    return null;
  }

  const pathsByVehicle = createExitPathsByVehicle(board);
  const allVehiclesMask = (1 << board.vehicles.length) - 1;
  const legalOptionsByMask = new Map<
    number,
    ReturnType<typeof listLegalVehicleOptions>
  >();
  const legalOrderCountByMask = new Map<number, bigint>([[0, 1n]]);
  const reachableMasks = new Set<number>();
  let nonterminalStateCount = 0;
  let legalVehicleRatioTotal = 0;
  let minimumLegalVehicleRatio = 1;
  let decisionStateCount = 0;
  let forcedChoiceStateCount = 0;
  let legalDirectionCountTotal = 0;
  let legalVehicleObservationCount = 0;
  let newlyUnlockedVehicleCountTotal = 0;
  let removalTransitionCount = 0;
  let maximumNewlyUnlockedVehicleCount = 0;

  function legalOptions(remainingMask: number) {
    const cached = legalOptionsByMask.get(remainingMask);
    if (cached) return cached;
    const options = listLegalVehicleOptions(
      board,
      pathsByVehicle,
      remainingMask,
    );
    legalOptionsByMask.set(remainingMask, options);
    return options;
  }

  function countOrders(remainingMask: number): bigint {
    const cachedCount = legalOrderCountByMask.get(remainingMask);
    if (cachedCount !== undefined) return cachedCount;

    reachableMasks.add(remainingMask);
    const options = legalOptions(remainingMask);
    const actualRemainingVehicleCount = board.vehicles.reduce(
      (count, _vehicle, index) =>
        count + Number((remainingMask & (1 << index)) !== 0),
      0,
    );
    if (actualRemainingVehicleCount > 0) {
      nonterminalStateCount += 1;
      const legalVehicleRatio = options.length / actualRemainingVehicleCount;
      legalVehicleRatioTotal += legalVehicleRatio;
      minimumLegalVehicleRatio = Math.min(
        minimumLegalVehicleRatio,
        legalVehicleRatio,
      );
      if (actualRemainingVehicleCount > 1) {
        decisionStateCount += 1;
        if (options.length === 1) forcedChoiceStateCount += 1;
      }
      legalDirectionCountTotal += options.reduce(
        (total, option) => total + option.legalDirectionCount,
        0,
      );
      legalVehicleObservationCount += options.length;
    }

    let total = 0n;
    const currentLegalVehicleMask = options.reduce(
      (mask, option) => mask | (1 << option.vehicleIndex),
      0,
    );
    for (const option of options) {
      const childMask = remainingMask & ~(1 << option.vehicleIndex);
      total += countOrders(childMask);
      const childLegalVehicleMask = legalOptions(childMask).reduce(
        (mask, childOption) => mask | (1 << childOption.vehicleIndex),
        0,
      );
      const newlyUnlockedMask =
        childLegalVehicleMask & ~currentLegalVehicleMask;
      const newlyUnlockedVehicleCount = board.vehicles.reduce(
        (count, _vehicle, index) =>
          count + Number((newlyUnlockedMask & (1 << index)) !== 0),
        0,
      );
      newlyUnlockedVehicleCountTotal += newlyUnlockedVehicleCount;
      removalTransitionCount += 1;
      maximumNewlyUnlockedVehicleCount = Math.max(
        maximumNewlyUnlockedVehicleCount,
        newlyUnlockedVehicleCount,
      );
    }

    legalOrderCountByMask.set(remainingMask, total);
    return total;
  }

  reachableMasks.add(0);
  const legalOrderCount = countOrders(allVehiclesMask);
  const canRemainAfterVehicleMask = Array.from(
    { length: board.vehicles.length },
    () => 0,
  );
  for (const remainingMask of reachableMasks) {
    for (
      let removedVehicleIndex = 0;
      removedVehicleIndex < board.vehicles.length;
      removedVehicleIndex += 1
    ) {
      if ((remainingMask & (1 << removedVehicleIndex)) !== 0) continue;
      canRemainAfterVehicleMask[removedVehicleIndex] =
        (canRemainAfterVehicleMask[removedVehicleIndex] ?? 0) | remainingMask;
    }
  }

  let requiredPrecedenceCount = 0;
  const requiredPredecessorCountByVehicle = Array.from(
    { length: board.vehicles.length },
    () => 0,
  );
  for (
    let predecessorIndex = 0;
    predecessorIndex < board.vehicles.length;
    predecessorIndex += 1
  ) {
    for (
      let targetIndex = 0;
      targetIndex < board.vehicles.length;
      targetIndex += 1
    ) {
      if (predecessorIndex === targetIndex) continue;
      const predecessorCanRemainAfterTarget =
        ((canRemainAfterVehicleMask[targetIndex] ?? 0) &
          (1 << predecessorIndex)) !==
        0;
      if (predecessorCanRemainAfterTarget) continue;
      requiredPrecedenceCount += 1;
      requiredPredecessorCountByVehicle[targetIndex] =
        (requiredPredecessorCountByVehicle[targetIndex] ?? 0) + 1;
    }
  }

  return {
    legalOrderCount,
    reachableStateCount: reachableMasks.size,
    averageLegalVehicleRatio:
      nonterminalStateCount === 0
        ? 1
        : legalVehicleRatioTotal / nonterminalStateCount,
    minimumLegalVehicleRatio,
    forcedChoiceStateRatio:
      decisionStateCount === 0
        ? 0
        : forcedChoiceStateCount / decisionStateCount,
    averageLegalDirectionCount:
      legalVehicleObservationCount === 0
        ? 0
        : legalDirectionCountTotal / legalVehicleObservationCount,
    averageNewlyUnlockedVehicleCount:
      removalTransitionCount === 0
        ? 0
        : newlyUnlockedVehicleCountTotal / removalTransitionCount,
    maximumNewlyUnlockedVehicleCount,
    requiredPrecedenceCount,
    maximumRequiredPredecessorCount: Math.max(
      0,
      ...requiredPredecessorCountByVehicle,
    ),
  };
}

function countLegalVehicleOrders(board: ParkingJamBoard): bigint | null {
  return analyzeLegalOrderSpace(board)?.legalOrderCount ?? null;
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

function calculateVehicleCellOccupancyRatio(board: ParkingJamBoard): number {
  const boardCellCount = board.width * board.height;
  if (boardCellCount === 0) return 0;
  const vehicleCellCount = board.vehicles.reduce(
    (count, vehicle) => count + listParkingJamVehicleCells(vehicle).length,
    0,
  );
  return vehicleCellCount / boardCellCount;
}

function calculateRoadOpeningCoverageRatio(board: ParkingJamBoard): number {
  const perimeterCellCount = 2 * board.width + 2 * board.height;
  if (perimeterCellCount === 0) return 0;
  const openingCellCount = board.roadOpenings.reduce(
    (count, opening) => count + opening.length,
    0,
  );
  return openingCellCount / perimeterCellCount;
}

function calculateExitPathFeatures(board: ParkingJamBoard): {
  averageExitPathLength: number;
  maximumExitPathLength: number;
} {
  const paths = [...createExitPathsByVehicle(board).values()].flat();
  if (paths.length === 0) {
    return { averageExitPathLength: 0, maximumExitPathLength: 0 };
  }
  const pathLengths = paths.map((path) => path.pathLength);
  return {
    averageExitPathLength:
      pathLengths.reduce((total, length) => total + length, 0) /
      pathLengths.length,
    maximumExitPathLength: Math.max(...pathLengths),
  };
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
  const orderSpace = analyzeLegalOrderSpace(board);
  const legalOrderCount = orderSpace?.legalOrderCount ?? null;
  const vehicleCount = board.vehicles.length;
  const exitPathFeatures = calculateExitPathFeatures(board);
  const features: ParkingJamDifficultyFeatures = {
    dependencyDepth: solvabilityAnalysis.removalLayers.length,
    initialLegalVehicleCount: initialLegalVehicleIds.size,
    initialLegalVehicleRatio:
      vehicleCount === 0 ? 1 : initialLegalVehicleIds.size / vehicleCount,
    vehicleBlockingEdgeCount: blockers.vehicleBlockingEdgeCount,
    maximumVehicleBlockingOutDegree: blockers.maximumVehicleBlockingOutDegree,
    maximumVehicleBlockingInDegree: blockers.maximumVehicleBlockingInDegree,
    availableExitDirectionCount: blockers.availableExitDirectionCount,
    initialBlockedExitDirectionCount: blockers.initialBlockedExitDirectionCount,
    initialBlockedExitDirectionRatio:
      blockers.availableExitDirectionCount === 0
        ? 0
        : blockers.initialBlockedExitDirectionCount /
          blockers.availableExitDirectionCount,
    legalOrderCount: legalOrderCount?.toString() ?? null,
    solutionOrderFreedom: calculateOrderFreedom(vehicleCount, legalOrderCount),
    reachableStateCount: orderSpace?.reachableStateCount ?? null,
    averageLegalVehicleRatio: orderSpace?.averageLegalVehicleRatio ?? null,
    minimumLegalVehicleRatio: orderSpace?.minimumLegalVehicleRatio ?? null,
    forcedChoiceStateRatio: orderSpace?.forcedChoiceStateRatio ?? null,
    averageLegalDirectionCount: orderSpace?.averageLegalDirectionCount ?? null,
    averageNewlyUnlockedVehicleCount:
      orderSpace?.averageNewlyUnlockedVehicleCount ?? null,
    maximumNewlyUnlockedVehicleCount:
      orderSpace?.maximumNewlyUnlockedVehicleCount ?? null,
    requiredPrecedenceCount: orderSpace?.requiredPrecedenceCount ?? null,
    maximumRequiredPredecessorCount:
      orderSpace?.maximumRequiredPredecessorCount ?? null,
    vehicleCellOccupancyRatio: calculateVehicleCellOccupancyRatio(board),
    longVehicleRatio:
      vehicleCount === 0
        ? 0
        : board.vehicles.filter((vehicle) => vehicle.length === 3).length /
          vehicleCount,
    roadOpeningCoverageRatio: calculateRoadOpeningCoverageRatio(board),
    ...exitPathFeatures,
  };

  return {
    status: orderSpace === null ? "unsupported" : "supported",
    features,
  };
}

export const _private = {
  analyzeLegalOrderSpace,
  countLegalVehicleOrders,
};
