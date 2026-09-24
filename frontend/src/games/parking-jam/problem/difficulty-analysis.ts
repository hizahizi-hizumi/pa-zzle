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
  averageLegalVehicleCount: number;
  averageLegalVehicleRatio: number;
  minimumLegalVehicleRatio: number;
  forcedChoiceStateRatio: number;
  maximumForcedChoiceChainLength: number;
  averageMinimumBlockingVehicleCount: number;
  averageLegalDirectionCount: number;
  averageNewlyUnlockedVehicleCount: number;
  maximumNewlyUnlockedVehicleCount: number;
  requiredPrecedenceCount: number;
  maximumRequiredPredecessorCount: number;
};

export type ParkingJamDifficultyFeatures = {
  vehicleCount: number;
  dependencyDepth: number;
  initialLegalVehicleCount: number;
  initialLegalVehicleRatio: number;
  initialAverageMinimumBlockingVehicleCount: number;
  vehicleBlockingEdgeCount: number;
  maximumVehicleBlockingOutDegree: number;
  maximumVehicleBlockingInDegree: number;
  availableExitDirectionCount: number;
  initialBlockedExitDirectionCount: number;
  initialBlockedExitDirectionRatio: number;
  legalOrderCount: string | null;
  solutionOrderFreedom: number | null;
  reachableStateCount: number | null;
  averageLegalVehicleCount: number | null;
  averageLegalVehicleRatio: number | null;
  minimumLegalVehicleRatio: number | null;
  forcedChoiceStateRatio: number | null;
  maximumForcedChoiceChainLength: number | null;
  averageMinimumBlockingVehicleCount: number | null;
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
  initialAverageMinimumBlockingVehicleCount: number;
  vehicleBlockingEdgeCount: number;
  maximumVehicleBlockingOutDegree: number;
  maximumVehicleBlockingInDegree: number;
} {
  const state = createParkingJamInitialState(board);
  let availableExitDirectionCount = 0;
  let initialBlockedExitDirectionCount = 0;
  let vehicleBlockingEdgeCount = 0;
  const minimumBlockingVehicleCounts: number[] = [];
  const blockedVehicleIdsByBlocker = new Map<
    ParkingJamVehicleId,
    Set<ParkingJamVehicleId>
  >();
  const blockerIdsByBlockedVehicle = new Map<
    ParkingJamVehicleId,
    Set<ParkingJamVehicleId>
  >();

  for (const vehicle of board.vehicles) {
    const blockingVehicleCounts: number[] = [];
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
      blockingVehicleCounts.push(vehicleBlockers.length);
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
    if (blockingVehicleCounts.length > 0) {
      const minimumBlockingVehicleCount = Math.min(...blockingVehicleCounts);
      if (minimumBlockingVehicleCount > 0) {
        minimumBlockingVehicleCounts.push(minimumBlockingVehicleCount);
      }
    }
  }

  return {
    availableExitDirectionCount,
    initialBlockedExitDirectionCount,
    initialAverageMinimumBlockingVehicleCount:
      minimumBlockingVehicleCounts.length === 0
        ? 0
        : minimumBlockingVehicleCounts.reduce(
            (total, count) => total + count,
            0,
          ) / minimumBlockingVehicleCounts.length,
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

type ParkingJamVehicleStateOption = {
  vehicleIndex: number;
  legalDirectionCount: number;
  minimumBl²È="25½ÁÑ¥½¸¤É•ÑÕÉ¸€Àì(€€€½¹ÍÐ¡¥±‘5…Í¬€ôÉ•µ…¥¹¥¹5…Í¬€˜ø Ä€ðð½ÁÑ¥½¸¹Ù•¡¥±•%¹‘•à¤ì(€€€½¹ÍÐ±•¹Ñ €ô€Ä€¬™½É•‘¡½¥•¡…¥¹1•¹Ñ ¡¡¥±‘5…Í¬¤ì(€€€™½É•‘¡½¥•¡…¥¹1•¹Ñ¡	å5…Í¬¹Í•Ð¡É•µ…¥¹¥¹5…Í¬°±•¹Ñ ¤ì(€€€É•ÑÕÉ¸±•¹Ñ ì(€ô((€±•Ðµ…á¥µÕµ½É•‘¡½¥•¡…¥¹1•¹Ñ €ô€Àì(€™½È€¡½¹ÍÐÉ•µ…¥¹¥¹5…Í¬½˜É•…¡…‰±•5…Í­Ì¤ì(€€€µ…á¥µÕµ½É•‘¡½¥•¡…¥¹1•¹Ñ €ô5…Ñ ¹µ…à (€€€€€µ…á¥µÕµ½É•‘¡½¥•¡…¥¹1•¹Ñ °(€€€€€™½É•‘¡½¥•¡…¥¹1•¹Ñ ¡É•µ…¥¹¥¹5…Í¬¤°(€€€€¤ì(€ô((€±•ÐÉ•ÅÕ¥É•‘AÉ••‘•¹•½Õ¹Ð€ô€Àì(€½¹ÍÐÉ•ÅÕ¥É•‘AÉ•‘••ÍÍ½É½Õ¹Ñ	åY•¡¥±”€ôÉÉ…ä¹™É½´ (€€€ì±•¹Ñ è‰½…É¹Ù•¡¥±•Ì¹±•¹Ñ ô°(€€€€ ¤€ôø€À°(€€¤ì(€™½È€ (€€€±•ÐÁÉ•‘••ÍÍ½É%¹‘•à€ô€Àì(€€€ÁÉ•‘••ÍÍ½É%¹‘•à€ð‰½…É¹Ù•¡¥±•Ì¹±•¹Ñ ì(€€€ÁÉ•‘••ÍÍ½É%¹‘•à€¬ô€Ä(€€¤ì(€€€™½È€ (€€€€€±•ÐÑ…É•Ñ%¹‘•à€ô€Àì(€€€€€Ñ…É•Ñ%¹‘•à€ð‰½…É¹Ù•¡¥±•Ì¹±•¹Ñ ì(€€€€€Ñ…É•Ñ%¹‘•à€¬ô€Ä(€€€€¤ì(€€€€€¥˜€¡ÁÉ•‘••ÍÍ½É%¹‘•à€ôôôÑ…É•Ñ%¹‘•à¤½¹Ñ¥¹Õ”ì(€€€€€½¹ÍÐÁÉ•‘••ÍÍ½É…¹I•µ…¥¹™Ñ•ÉQ…É•Ð€ô(€€€€€€€€ ¡…¹I•µ…¥¹™Ñ•ÉY•¡¥±•5…Í­mÑ…É•Ñ%¹‘•át€üü€À¤€˜(€€€€€€€€€€ Ä€ððÁÉ•‘••ÍÍ½É%¹‘•à¤¤€„ôô(€€€€€€€€Àì(€€€€€¥˜€¡ÁÉ•‘••ÍÍ½É…¹I•µ…¥¹™Ñ•ÉQ…É•Ð¤½¹Ñ¥¹Õ”ì(€€€€€É•ÅÕ¥É•‘AÉ••‘•¹•½Õ¹Ð€¬ô€Äì(€€€€€É•ÅÕ¥É•‘AÉ•‘••ÍÍ½É½Õ¹Ñ	åY•¡¥±•mÑ…É•Ñ%¹‘•át€ô(€€€€€€€€¡É•ÅÕ¥É•‘AÉ•‘••ÍÍ½É½Õ¹Ñ	åY•¡¥±•mÑ…É•Ñ%¹‘•át€üü€À¤€¬€Äì(€€€ô(€ô((€É•ÑÕÉ¸ì(€€€±•…±=É‘•É½Õ¹Ð°(€€€É•…¡…‰±•MÑ…Ñ•½Õ¹ÐèÉ•…¡…‰±•5…Í­Ì¹Í¥é”°(€€€…Ù•É…•1•…±Y•¡¥±•½Õ¹Ðè(€€€€€¹½¹Ñ•Éµ¥¹…±MÑ…Ñ•½Õ¹Ð€ôôô€À(€€€€€€€€ü€À(€€€€€€€€è±•…±Y•¡¥±•½Õ¹ÑQ½Ñ…°€¼¹½¹Ñ•Éµ¥¹…±MÑ…Ñ•½Õ¹Ð°(€€€…Ù•É…•1•…±Y•¡¥±•I…Ñ¥¼è(€€€€€¹½¹Ñ•Éµ¥¹…±MÑ…Ñ•½Õ¹Ð€ôôô€À(€€€€€€€€ü€Ä(€€€€€€€€è±•…±Y•¡¥±•I…Ñ¥½Q½Ñ…°€¼¹½¹Ñ•Éµ¥¹…±MÑ…Ñ•½Õ¹Ð°(€€€µ¥¹¥µÕµ1•…±Y•¡¥±•I…Ñ¥¼°(€€€™½É•‘¡½¥•MÑ…Ñ•I…Ñ¥¼è(€€€€€‘•¥Í¥½¹MÑ…Ñ•½Õ¹Ð€ôôô€À(€€€€€€€€ü€À(€€€€€€€€è™½É•‘¡½¥•MÑ…Ñ•½Õ¹Ð€¼‘•¥Í¥½¹MÑ…Ñ•½Õ¹Ð°(€€€µ…á¥µÕµ½É•‘¡½¥•¡…¥¹1•¹Ñ °(€€€…Ù•É…•5¥¹¥µÕµ	±½­¥¹Y•¡¥±•½Õ¹Ðè(€€€€€‰±½­•‘…¹‘¥‘…Ñ•=‰Í•ÉÙ…Ñ¥½¹½Õ¹Ð€ôôô€À(€€€€€€€€ü€À(€€€€€€€€è‰±½­¥¹Y•¡¥±•½Õ¹ÑQ½Ñ…°€¼‰±½­•‘…¹‘¥‘…Ñ•=‰Í•ÉÙ…Ñ¥½¹½Õ¹Ð°(€€€…Ù•É…•1•…±¥É•Ñ¥½¹½Õ¹Ðè(€€€€€±•…±Y•¡¥±•=‰Í•ÉÙ…Ñ¥½¹½Õ¹Ð€ôôô€À(€€€€€€€€ü€À(€€€€€€€€è±•…±¥É•Ñ¥½¹½Õ¹ÑQ½Ñ…°€¼±•…±Y•¡¥±•=‰Í•ÉÙ…Ñ¥½¹½Õ¹Ð°(€€€…Ù•É…•9•Ý±åU¹±½­•‘Y•¡¥±•½Õ¹Ðè(€€€€€É•µ½Ù…±QÉ…¹Í¥Ñ¥½¹½Õ¹Ð€ôôô€À(€€€€€€€€ü€À(€€€€€€€€è¹•Ý±åU¹±½­•‘Y•¡¥±•½Õ¹ÑQ½Ñ…°€¼É•µ½Ù…±QÉ…¹Í¥Ñ¥½¹½Õ¹Ð°(€€€µ…á¥µÕµ9•Ý±åU¹±½­•‘Y•¡¥±•½Õ¹Ð°(€€€É•ÅÕ¥É•‘AÉ••‘•¹•½Õ¹Ð°(€€€µ…á¥µÕµI•ÅÕ¥É•‘AÉ•‘••ÍÍ½É½Õ¹Ðè5…Ñ ¹µ…à (€€€€€€À°(€€€€€€¸¸¹É•ÅÕ¥É•‘AÉ•‘••ÍÍ½É½Õ¹Ñ	åY•¡¥±”°(€€€€¤°(€ôì)ô()™Õ¹Ñ¥½¸½Õ¹Ñ1•…±Y•¡¥±•=É‘•ÉÌ¡‰½…ÉèA…É­¥¹)…µ	½…É¤è‰¥¥¹Ðð¹Õ±°ì(€É•ÑÕÉ¸…¹…±åé•1•…±=É‘•ÉMÁ…”¡‰½…É¤ü¹±•…±=É‘•É½Õ¹Ð€üü¹Õ±°ì)ô()™Õ¹Ñ¥½¸…±Õ±…Ñ•=É‘•ÉÉ••‘½´ (€Ù•¡¥±•½Õ¹Ðè¹Õµ‰•È°(€±•…±=É‘•É½Õ¹Ðè‰¥¥¹Ðð¹Õ±°°(¤è¹Õµ‰•Èð¹Õ±°ì(€¥˜€¡±•…±=É‘•É½Õ¹Ð€ôôô¹Õ±°¤É•ÑÕÉ¸¹Õ±°ì(€¥˜€¡Ù•¡¥±•½Õ¹Ð€ðô€Ä¤É•ÑÕÉ¸€Äì(€½¹ÍÐµ…á¥µÕµ=É‘•É½Õ¹Ð€ô™…Ñ½É¥…°¡Ù•¡¥±•½Õ¹Ð¤ì(€¥˜€¡µ…á¥µÕµ=É‘•É½Õ¹Ð€ðô€Ä¤É•ÑÕÉ¸€Äì(€É•ÑÕÉ¸5…Ñ ¹±½œ¡9Õµ‰•È¡±•…±=É‘•É½Õ¹Ð¤¤€¼5…Ñ ¹±½œ¡µ…á¥µÕµ=É‘•É½Õ¹Ð¤ì)ô()™Õ¹Ñ¥½¸…±Õ±…Ñ•Y•¡¥±••±±=ÕÁ…¹åI…Ñ¥¼¡‰½…ÉèA…É­¥¹)…µ	½…É¤è¹Õµ‰•Èì(€½¹ÍÐ‰½…É‘•±±½Õ¹Ð€ô‰½…É¹Ý¥‘Ñ €¨‰½…É¹¡•¥¡Ðì(€¥˜€¡‰½…É‘•±±½Õ¹Ð€ôôô€À¤É•ÑÕÉ¸€Àì(€½¹ÍÐÙ•¡¥±••±±½Õ¹Ð€ô‰½…É¹Ù•¡¥±•Ì¹É•‘Õ” (€€€€¡½Õ¹Ð°Ù•¡¥±”¤€ôø½Õ¹Ð€¬±¥ÍÑA…É­¥¹)…µY•¡¥±••±±Ì¡Ù•¡¥±”¤¹±•¹Ñ °(€€€€À°(€€¤ì(€É•ÑÕÉ¸Ù•¡¥±••±±½Õ¹Ð€¼‰½…É‘•±±½Õ¹Ðì)ô()™Õ¹Ñ¥½¸…±Õ±…Ñ•I½…‘=Á•¹¥¹½Ù•É…•I…Ñ¥¼¡‰½…ÉèA…É­¥¹)…µ	½…É¤è¹Õµ‰•Èì(€½¹ÍÐÁ•É¥µ•Ñ•É•±±½Õ¹Ð€ô€È€¨‰½…É¹Ý¥‘Ñ €¬€È€¨‰½…É¹¡•¥¡Ðì(€¥˜€¡Á•É¥µ•Ñ•É•±±½Õ¹Ð€ôôô€À¤É•ÑÕÉ¸€Àì(€½¹ÍÐ½Á•¹¥¹•±±½Õ¹Ð€ô‰½…É¹É½…‘=Á•¹¥¹Ì¹É•‘Õ” (€€€€¡½Õ¹Ð°½Á•¹¥¹œ¤€ôø½Õ¹Ð€¬½Á•¹¥¹œ¹±•¹Ñ °(€€€€À°(€€¤ì(€É•ÑÕÉ¸½Á•¹¥¹•±±½Õ¹Ð€¼Á•É¥µ•Ñ•É•±±½Õ¹Ðì)ô()™Õ¹Ñ¥½¸…±Õ±…Ñ•á¥ÑA…Ñ¡•…ÑÕÉ•Ì¡‰½…ÉèA…É­¥¹)…µ	½…É¤èì(€…Ù•É…•á¥ÑA…Ñ¡1•¹Ñ è¹Õµ‰•Èì(€µ…á¥µÕµá¥ÑA…Ñ¡1•¹Ñ è¹Õµ‰•Èì)ôì(€½¹ÍÐÁ…Ñ¡Ì€ôl¸¸¹É•…Ñ•á¥ÑA…Ñ¡Í	åY•¡¥±”¡‰½…É¤¹Ù…±Õ•Ì ¥t¹™±…Ð ¤ì(€¥˜€¡Á…Ñ¡Ì¹±•¹Ñ €ôôô€À¤ì(€€€É•ÑÕÉ¸ì…Ù•É…•á¥ÑA…Ñ¡1•¹Ñ è€À°µ…á¥µÕµá¥ÑA…Ñ¡1•¹Ñ è€Àôì(€ô(€½¹ÍÐÁ…Ñ¡1•¹Ñ¡Ì€ôÁ…Ñ¡Ì¹µ…À ¡Á…Ñ ¤€ôøÁ…Ñ ¹Á…Ñ¡1•¹Ñ ¤ì(€É•ÑÕÉ¸ì(€€€…Ù•É…•á¥ÑA…Ñ¡1•¹Ñ è(€€€€€Á…Ñ¡1•¹Ñ¡Ì¹É•‘Õ” ¡Ñ½Ñ…°°±•¹Ñ ¤€ôøÑ½Ñ…°€¬±•¹Ñ °€À¤€¼(€€€€€Á…Ñ¡1•¹Ñ¡Ì¹±•¹Ñ °(€€€µ…á¥µÕµá¥ÑA…Ñ¡1•¹Ñ è5…Ñ ¹µ…à ¸¸¹Á…Ñ¡1•¹Ñ¡Ì¤°(€ôì)ô()•áÁ½ÉÐ™Õ¹Ñ¥½¸…¹…±åé•A…É­¥¹)…µ¥™™¥Õ±Ñä (€‰½…ÉèA…É­¥¹)…µ	½…É°(€Í½±Ù…‰¥±¥Ñå¹…±åÍ¥Ìèì(€€€É•µ½Ù…±1…å•ÉÌèÉ•…‘½¹±ä€¡É•…‘½¹±äA…É­¥¹)…µY•¡¥±•%‘mt¥mtì(€ô°(¤èA…É­¥¹)…µ¥™™¥Õ±Ñå¹…±åÍ¥Ìì(€½¹ÍÐÍÑ…Ñ”€ôÉ•…Ñ•A…É­¥¹)…µ%¹¥Ñ¥…±MÑ…Ñ”¡‰½…É¤ì(€½¹ÍÐ¥¹¥Ñ¥…±1•…±Y•¡¥±•%‘Ì€ô¹•ÜM•Ð (€€€±¥ÍÑA…É­¥¹)…µ1•…±5½Ù•Ì¡‰½…É°ÍÑ…Ñ”¤¹µ…À ¡µ½Ù”¤€ôøµ½Ù”¹Ù•¡¥±•%¤°(€€¤ì(€½¹ÍÐ‰±½­•ÉÌ€ô½Õ¹ÑY•¡¥±•	±½­¥¹‘•Ì¡‰½…É¤ì(€½¹ÍÐ½É‘•ÉMÁ…”€ô…¹…±åé•1•…±=É‘•ÉMÁ…”¡‰½…É¤ì(€½¹ÍÐ±•…±=É‘•É½Õ¹Ð€ô½É‘•ÉMÁ…”ü¹±•…±=É‘•É½Õ¹Ð€üü¹Õ±°ì(€½¹ÍÐÙ•¡¥±•½Õ¹Ð€ô‰½…É¹Ù•¡¥±•Ì¹±•¹Ñ ì(€½¹ÍÐ•á¥ÑA…Ñ¡•…ÑÕÉ•Ì€ô…±Õ±…Ñ•á¥ÑA…Ñ¡•…ÑÕÉ•Ì¡‰½…É¤ì(€½¹ÍÐ™•…ÑÕÉ•ÌèA…É­¥¹)…µ¥™™¥Õ±Ñå•…ÑÕÉ•Ì€ôì(€€€Ù•¡¥±•½Õ¹Ð°(€€€‘•Á•¹‘•¹å•ÁÑ èÍ½±Ù…‰¥±¥Ñå¹…±åÍ¥Ì¹É•µ½Ù…±1…å•ÉÌ¹±•¹Ñ °(€€€¥¹¥Ñ¥…±1•…±Y•¡¥±•½Õ¹Ðè¥¹¥Ñ¥…±1•…±Y•¡¥±•%‘Ì¹Í¥é”°(€€€¥¹¥Ñ¥…±1•…±Y•¡¥±•I…Ñ¥¼è(€€€€€Ù•¡¥±•½Õ¹Ð€ôôô€À€ü€Ä€è¥¹¥Ñ¥…±1•…±Y•¡¥±•%‘Ì¹Í¥é”€¼Ù•¡¥±•½Õ¹Ð°(€€€¥¹¥Ñ¥…±Ù•É…•5¥¹¥µÕµ	±½­¥¹Y•¡¥±•½Õ¹Ðè(€€€€€‰±½­•ÉÌ¹¥¹¥Ñ¥…±Ù•É…•5¥¹¥µÕµ	±½­¥¹Y•¡¥±•½Õ¹Ð°(€€€Ù•¡¥±•	±½­¥¹‘•½Õ¹Ðè‰±½­•ÉÌ¹Ù•¡¥±•	±½­¥¹‘•½Õ¹Ð°(€€€µ…á¥µÕµY•¡¥±•	±½­¥¹=ÕÑ•É•”è‰±½­•ÉÌ¹µ…á¥µÕµY•¡¥±•	±½­¥¹=ÕÑ•É•”°(€€€µ…á¥µÕµY•¡¥±•	±½­¥¹%¹•É•”è‰±½­•ÉÌ¹µ…á¥µÕµY•¡¥±•	±½­¥¹%¹•É•”°(€€€…Ù…¥±…‰±•á¥Ñ¥É•Ñ¥½¹½Õ¹Ðè‰±½­•ÉÌ¹…Ù…¥±…‰±•á¥Ñ¥É•Ñ¥½¹½Õ¹Ð°(€€€¥¹¥Ñ¥…±	±½­•‘á¥Ñ¥É•Ñ¥½¹½Õ¹Ðè‰±½­•ÉÌ¹¥¹¥Ñ¥…±	±½­•‘á¥Ñ¥É•Ñ¥½¹½Õ¹Ð°(€€€¥¹¥Ñ¥…±	±½­•‘á¥Ñ¥É•Ñ¥½¹I…Ñ¥¼è(€€€€€‰±½­•ÉÌ¹…Ù…¥±…‰±•á¥Ñ¥É•Ñ¥½¹½Õ¹Ð€ôôô€À(€€€€€€€€ü€À(€€€€€€€€è‰±½­•ÉÌ¹¥¹¥Ñ¥…±	±½­•‘á¥Ñ¥É•Ñ¥½¹½Õ¹Ð€¼(€€€€€€€€€‰±½­•ÉÌ¹…Ù…¥±…‰±•á¥Ñ¥É•Ñ¥½¹½Õ¹Ð°(€€€±•…±=É‘•É½Õ¹Ðè±•…±=É‘•É½Õ¹Ðü¹Ñ½MÑÉ¥¹œ ¤€üü¹Õ±°°(€€€Í½±ÕÑ¥½¹=É‘•ÉÉ••‘½´è…±Õ±…Ñ•=É‘•ÉÉ••‘½´¡Ù•¡¥±•½Õ¹Ð°±•…±=É‘•É½Õ¹Ð¤°(€€€É•…¡…‰±•MÑ…Ñ•½Õ¹Ðè½É‘•ÉMÁ…”ü¹É•…¡…‰±•MÑ…Ñ•½Õ¹Ð€üü¹Õ±°°(€€€…Ù•É…•1•…±Y•¡¥±•½Õ¹Ðè½É‘•ÉMÁ…”ü¹…Ù•É…•1•…±Y•¡¥±•½Õ¹Ð€üü¹Õ±°°(€€€…Ù•É…•1•…±Y•¡¥±•I…Ñ¥¼è½É‘•ÉMÁ…”ü¹…Ù•É…•1•…±Y•¡¥±•I…Ñ¥¼€üü¹Õ±°°(€€€µ¥¹¥µÕµ1•…±Y•¡¥±•I…Ñ¥¼è½É‘•ÉMÁ…”ü¹µ¥¹¥µÕµ1•…±Y•¡¥±•I…Ñ¥¼€üü¹Õ±°°(€€€™½É•‘¡½¥•MÑ…Ñ•I…Ñ¥¼è½É‘•ÉMÁ…”ü¹™½É•‘¡½¥•MÑ…Ñ•I…Ñ¥¼€üü¹Õ±°°(€€€µ…á¥µÕµ½É•‘¡½¥•¡…¥¹1•¹Ñ è(€€€€€½É‘•ÉMÁ…”ü¹µ…á¥µÕµ½É•‘¡½¥•¡…¥¹1•¹Ñ €üü¹Õ±°°(€€€…Ù•É…•5¥¹¥µÕµ	±½­¥¹Y•¡¥±•½Õ¹Ðè(€€€€€½É‘•ÉMÁ…”ü¹…Ù•É…•5¥¹¥µÕµ	±½­¥¹Y•¡¥±•½Õ¹Ð€üü¹Õ±°°(€€€…Ù•É…•1•…±¥É•Ñ¥½¹½Õ¹Ðè½É‘•ÉMÁ…”ü¹…Ù•É…•1•…±¥É•Ñ¥½¹½Õ¹Ð€üü¹Õ±°°(€€€…Ù•É…•9•Ý±åU¹±½­•‘Y•¡¥±•½Õ¹Ðè(€€€€€½É‘•ÉMÁ…”ü¹…Ù•É…•9•Ý±åU¹±½­•‘Y•¡¥±•½Õ¹Ð€üü¹Õ±°°(€€€µ…á¥µÕµ9•Ý±åU¹±½­•‘Y•¡¥±•½Õ¹Ðè(€€€€€½É‘•ÉMÁ…”ü¹µ…á¥µÕµ9•Ý±åU¹±½­•‘Y•¡¥±•½Õ¹Ð€üü¹Õ±°°(€€€É•ÅÕ¥É•‘AÉ••‘•¹•½Õ¹Ðè½É‘•ÉMÁ…”ü¹É•ÅÕ¥É•‘AÉ••‘•¹•½Õ¹Ð€üü¹Õ±°°(€€€µ…á¥µÕµI•ÅÕ¥É•‘AÉ•‘••ÍÍ½É½Õ¹Ðè(€€€€€½É‘•ÉMÁ…”ü¹µ…á¥µÕµI•ÅÕ¥É•‘AÉ•‘••ÍÍ½É½Õ¹Ð€üü¹Õ±°°(€€€Ù•¡¥±••±±=ÕÁ…¹åI…Ñ¥¼è…±Õ±…Ñ•Y•¡¥±••±±=ÕÁ…¹åI…Ñ¥¼¡‰½…É¤°(€€€±½¹Y•¡¥±•I…Ñ¥¼è(€€€€€Ù•¡¥±•½Õ¹Ð€ôôô€À(€€€€€€€€ü€À(€€€€€€€€è‰½…É¹Ù•¡¥±•Ì¹™¥±Ñ•È ¡Ù•¡¥±”¤€ôøÙ•¡¥±”¹±•¹Ñ €ôôô€Ì¤¹±•¹Ñ €¼(€€€€€€€€€Ù•¡¥±•½Õ¹Ð°(€€€É½…‘=Á•¹¥¹½Ù•É…•I…Ñ¥¼è…±Õ±…Ñ•I½…‘=Á•¹¥¹½Ù•É…•I…Ñ¥¼¡‰½…É¤°(€€€€¸¸¹•á¥ÑA…Ñ¡•…ÑÕÉ•Ì°(€ôì((€É•ÑÕÉ¸ì(€€€ÍÑ…ÑÕÌè½É‘•ÉMÁ…”€ôôô¹Õ±°€ü€‰Õ¹ÍÕÁÁ½ÉÑ•ˆ€è€‰ÍÕÁÁ½ÉÑ•ˆ°(€€€™•…ÑÕÉ•Ì°(€ôì)ô()•áÁ½ÉÐ½¹ÍÐ}ÁÉ¥Ù…Ñ”€ôì(€…¹…±åé•1•…±=É‘•ÉMÁ…”°(€½Õ¹Ñ1•…±Y•¡¥±•=É‘•ÉÌ°)ôì(