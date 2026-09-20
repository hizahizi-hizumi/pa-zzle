import {
  createProblemRandom,
  type ProblemRandom,
  shuffleProblemValues,
} from "@/games/problem-random";
import type { ProblemSeed } from "@/games/problem-seed";
import {
  createParkingJamInitialState,
  listParkingJamFixedAreaCells,
  listParkingJamVehicleCells,
  PARKING_JAM_VEHICLE_LENGTHS,
  type ParkingJamBoard,
  type ParkingJamCell,
  type ParkingJamFixedArea,
  type ParkingJamOrientation,
  type ParkingJamRoadOpening,
  type ParkingJamVehicle,
  validateParkingJamBoard,
} from "../puzzle/board";
import { listParkingJamLegalMoves } from "../puzzle/rules";
import { analyzeParkingJamDifficulty } from "./difficulty-analysis";
import { analyzeParkingJamSolvability } from "./generation/solvability";
import {
  PARKING_JAM_GENERATOR_VERSION,
  type ParkingJamGeneratedProblem,
  type ParkingJamGenerationConditions,
  type ParkingJamProblemIdentity,
  type ParkingJamSolvabilityAnalysis,
} from "./problem";

export type ParkingJamGeneratedCandidate = {
  attempt: number;
  board: ParkingJamBoard;
  solvabilityAnalysis: ParkingJamSolvabilityAnalysis;
  difficultyAnalysis: ParkingJamGeneratedProblem["difficultyAnalysis"];
};

export type ParkingJamProblemAcceptance = (
  candidate: ParkingJamGeneratedCandidate,
) => boolean;

export type ParkingJamGeneratorOptions = Omit<
  ParkingJamGenerationConditions,
  "blockingPlacementProbability"
> & {
  seed: ProblemSeed;
  blockingPlacementProbability?: number;
  maximumAttempts?: number;
  acceptCandidate?: ParkingJamProblemAcceptance;
};

export class ParkingJamGenerationExhaustedError extends Error {
  constructor(maximumAttempts: number) {
    super(
      `Failed to generate a parking jam problem within ${maximumAttempts} attempts`,
    );
    this.name = "ParkingJamGenerationExhaustedError";
  }
}

function validateConditions(conditions: ParkingJamGenerationConditions): void {
  for (const [name, value] of [
    ["width", conditions.width],
    ["height", conditions.height],
  ] as const) {
    if (!Number.isInteger(value) || value < 2) {
      throw new RangeError(`${name} must be an integer of at least 2`);
    }
  }
  if (
    !Number.isInteger(conditions.vehicleCount) ||
    conditions.vehicleCount < 1
  ) {
    throw new RangeError("vehicleCount must be a positive integer");
  }
  for (const [name, value] of [
    ["roadOpeningCount", conditions.roadOpeningCount],
    ["roadOpeningSpan", conditions.roadOpeningSpan],
    ["fixedAreaCount", conditions.fixedAreaCount],
    ["fixedAreaLength", conditions.fixedAreaLength],
  ] as const) {
    if (
      !Number.isInteger(value) ||
      value < (name === "fixedAreaCount" ? 0 : 1)
    ) {
      throw new RangeError(
        `${name} must be ${name === "fixedAreaCount" ? "a non-negative" : "a positive"} integer`,
      );
    }
  }
  if (
    conditions.roadOpeningSpan > Math.max(conditions.width, conditions.height)
  ) {
    throw new RangeError("roadOpeningSpan must fit at least one board side");
  }
  const maximumRoadOpeningCount =
    2 * Math.floor((conditions.height + 1) / (conditions.roadOpeningSpan + 1)) +
    2 * Math.floor((conditions.width + 1) / (conditions.roadOpeningSpan + 1));
  if (conditions.roadOpeningCount > maximumRoadOpeningCount) {
    throw new RangeError(
      `roadOpeningCount must be at most ${maximumRoadOpeningCount} for this board`,
    );
  }
  if (
    conditions.fixedAreaCount > 0 &&
    conditions.fixedAreaLength >
      Math.max(conditions.width - 2, conditions.height - 2)
  ) {
    throw new RangeError("fixedAreaLength must fit inside the board boundary");
  }
  if (
    !Number.isFinite(conditions.blockingPlacementProbability) ||
    conditions.blockingPlacementProbability < 0 ||
    conditions.blockingPlacementProbability > 1
  ) {
    throw new RangeError(
      "blockingPlacementProbability must be between 0 and 1",
    );
  }
}

function validateMaximumAttempts(maximumAttempts: number): void {
  if (!Number.isInteger(maximumAttempts) || maximumAttempts < 1) {
    throw new RangeError("maximumAttempts must be a positive integer");
  }
}

function createGeneratorRandom(
  seed: ProblemSeed,
  conditions: ParkingJamGenerationConditions,
): ProblemRandom {
  return createProblemRandom(
    [
      PARKING_JAM_GENERATOR_VERSION,
      seed,
      conditions.width,
      conditions.height,
      conditions.vehicleCount,
      conditions.roadOpeningCount,
      conditions.roadOpeningSpan,
      conditions.fixedAreaCount,
      conditions.fixedAreaLength,
      conditions.blockingPlacementProbability,
    ].join(":"),
  );
}

function cellsOverlap(
  left: readonly ParkingJamCell[],
  right: readonly ParkingJamCell[],
): boolean {
  return left.some((leftCell) =>
    right.some(
      (rightCell) =>
        leftCell.row === rightCell.row && leftCell.column === rightCell.column,
    ),
  );
}

function createFixedAreas(
  conditions: ParkingJamGenerationConditions,
  random: ProblemRandom,
): ParkingJamFixedArea[] | null {
  if (conditions.fixedAreaCount === 0) return [];

  const candidates: ParkingJamFixedArea[] = [];
  const dimensions =
    conditions.fixedAreaLength === 1
      ? [{ width: 1, height: 1 }]
      : [
          { width: conditions.fixedAreaLength, height: 1 },
          { width: 1, height: conditions.fixedAreaLength },
        ];
  for (const { width, height } of dimensions) {
    for (let row = 1; row + height < conditions.height; row += 1) {
      for (let column = 1; column + width < conditions.width; column += 1) {
        candidates.push({ row, column, width, height });
      }
    }
  }

  const selected: ParkingJamFixedArea[] = [];
  for (const candidate of shuffleProblemValues(candidates, random)) {
    const cells = listParkingJamFixedAreaCells(candidate);
    if (
      selected.some((area) =>
        cellsOverlap(cells, listParkingJamFixedAreaCells(area)),
      )
    ) {
      continue;
    }
    selected.push(candidate);
    if (selected.length === conditions.fixedAreaCount) return selected;
  }
  return null;
}

function roadOpeningCandidates(
  conditions: ParkingJamGenerationConditions,
): ParkingJamRoadOpening[] {
  const candidates: ParkingJamRoadOpening[] = [];
  for (const side of ["left", "right", "up", "down"] as const) {
    const limit =
      side === "left" || side === "right"
        ? conditions.height
        : conditions.width;
    for (
      let startOffset = 0;
      startOffset + conditions.roadOpeningSpan <= limit;
      startOffset += 1
    ) {
      candidates.push({
        side,
        startOffset,
        length: conditions.roadOpeningSpan,
      });
    }
  }
  return candidates;
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

function createRoadOpenings(
  conditions: ParkingJamGenerationConditions,
  random: ProblemRandom,
): ParkingJamRoadOpening[] | null {
  const selected: ParkingJamRoadOpening[] = [];
  for (const candidate of shuffleProblemValues(
    roadOpeningCandidates(conditions),
    random,
  )) {
    if (
      selected.some((opening) => openingsOverlapOrTouch(opening, candidate))
    ) {
      continue;
    }
    selected.push(candidate);
    if (selected.length === conditions.roadOpeningCount) return selected;
  }
  return null;
}

type ParkingJamPlacementCandidate = {
  vehicle: ParkingJamVehicle;
  latestBlockedVehicleIndex: number | null;
};

function enumeratePlacements(
  board: Omit<ParkingJamBoard, "vehicles"> & {
    vehicles: readonly ParkingJamVehicle[];
  },
  vehicleId: string,
): ParkingJamPlacementCandidate[] {
  const occupiedVehicleCells = board.vehicles.flatMap(
    listParkingJamVehicleCells,
  );
  const legalVehicleIdsBeforePlacement = new Set(
    listParkingJamLegalMoves(board, createParkingJamInitialState(board)).map(
      (move) => move.vehicleId,
    ),
  );
  const vehicleIndexById = new Map(
    board.vehicles.map((vehicle, index) => [vehicle.id, index]),
  );
  const placements: ParkingJamPlacementCandidate[] = [];
  const orientations: readonly ParkingJamOrientation[] = [
    "horizontal",
    "vertical",
  ];

  for (const orientation of orientations) {
    for (const length of PARKING_JAM_VEHICLE_LENGTHS) {
      for (let row = 0; row < board.height; row += 1) {
        for (let column = 0; column < board.width; column += 1) {
          const vehicle = { id: vehicleId, row, column, orientation, length };
          const cells = listParkingJamVehicleCells(vehicle);
          const fits = cells.every(
            (cell) =>
              cell.row >= 0 &&
              cell.row < board.height &&
              cell.column >= 0 &&
              cell.column < board.width,
          );
          if (
            !fits ||
            cellsOverlap(
              cells,
              board.fixedAreas.flatMap(listParkingJamFixedAreaCells),
            ) ||
            cellsOverlap(cells, occupiedVehicleCells)
          ) {
            continue;
          }

          const candidateBoard: ParkingJamBoard = {
            ...board,
            vehicles: [...board.vehicles, vehicle],
          };
          const state = createParkingJamInitialState(candidateBoard);
          const legalMoves = listParkingJamLegalMoves(candidateBoard, state);
          const vehicleCanExit = legalMoves.some(
            (move) => move.vehicleId === vehicleId,
          );
          if (!vehicleCanExit) continue;

          const legalVehicleIdsAfterPlacement = new Set(
            legalMoves.map((move) => move.vehicleId),
          );
          const latestBlockedVehicleIndex = [
            ...legalVehicleIdsBeforePlacement,
          ].reduce<number | null>((latestIndex, existingVehicleId) => {
            if (legalVehicleIdsAfterPlacement.has(existingVehicleId)) {
              return latestIndex;
            }
            const blockedVehicleIndex = vehicleIndexById.get(existingVehicleId);
            if (blockedVehicleIndex === undefined) return latestIndex;
            return latestIndex === null
              ? blockedVehicleIndex
              : Math.max(latestIndex, blockedVehicleIndex);
          }, null);
          placements.push({ vehicle, latestBlockedVehicleIndex });
        }
      }
    }
  }

  return placements;
}

function choosePlacement(
  placements: readonly ParkingJamPlacementCandidate[],
  blockingPlacementProbability: number,
  random: ProblemRandom,
): ParkingJamVehicle | null {
  const blockingPlacements = placements.filter(
    ({ latestBlockedVehicleIndex }) => latestBlockedVehicleIndex !== null,
  );
  const shouldPreferBlockingPlacement =
    blockingPlacements.length > 0 && random() < blockingPlacementProbability;
  const latestDependencyTargetIndex = shouldPreferBlockingPlacement
    ? Math.max(
        ...blockingPlacements.map(
          ({ latestBlockedVehicleIndex }) => latestBlockedVehicleIndex ?? -1,
        ),
      )
    : null;
  const candidates = shouldPreferBlockingPlacement
    ? blockingPlacements.filter(
        ({ latestBlockedVehicleIndex }) =>
          latestBlockedVehicleIndex === latestDependencyTargetIndex,
      )
    : placements;
  const selected = candidates[Math.floor(random() * candidates.length)];
  return selected?.vehicle ?? null;
}

function createCandidate(
  conditions: ParkingJamGenerationConditions,
  random: ProblemRandom,
): ParkingJamBoard | null {
  const fixedAreas = createFixedAreas(conditions, random);
  const roadOpenings = createRoadOpenings(conditions, random);
  if (!fixedAreas || !roadOpenings) return null;
  const vehicles: ParkingJamVehicle[] = [];
  const boardBase = {
    width: conditions.width,
    height: conditions.height,
    fixedAreas,
    roadOpenings,
  };

  for (let index = 0; index < conditions.vehicleCount; index += 1) {
    const vehicleId = `v${index}`;
    const placements = enumeratePlacements(
      { ...boardBase, vehicles },
      vehicleId,
    );
    if (placements.length === 0) return null;
    const selected = choosePlacement(
      placements,
      conditions.blockingPlacementProbability,
      random,
    );
    if (!selected) return null;
    vehicles.push(selected);
  }

  const board: ParkingJamBoard = { ...boardBase, vehicles };
  validateParkingJamBoard(board);
  return board;
}

function createGeneratedProblem(
  identity: ParkingJamProblemIdentity,
  board: ParkingJamBoard,
): ParkingJamGeneratedProblem {
  const solvabilityAnalysis = analyzeParkingJamSolvability(board);
  if (solvabilityAnalysis.status !== "solvable") {
    throw new Error("Parking jam generator produced an unsolvable problem");
  }
  return {
    problem: { board },
    identity,
    solvabilityAnalysis,
    difficultyAnalysis: analyzeParkingJamDifficulty(board, solvabilityAnalysis),
  };
}

function candidateAtAttempt(
  identity: ParkingJamProblemIdentity,
): ParkingJamBoard | null {
  const random = createGeneratorRandom(identity.seed, identity.conditions);
  let candidate: ParkingJamBoard | null = null;
  for (let attempt = 1; attempt <= identity.generationAttempt; attempt += 1) {
    candidate = createCandidate(identity.conditions, random);
  }
  return candidate;
}

function validateIdentity(identity: ParkingJamProblemIdentity): void {
  if (identity.generatorVersion !== PARKING_JAM_GENERATOR_VERSION) {
    throw new Error(
      `Unsupported parking jam generator version: ${identity.generatorVersion}`,
    );
  }
  validateConditions(identity.conditions);
  validateMaximumAttempts(identity.generationAttempt);
}

export function restoreParkingJamProblem(
  identity: ParkingJamProblemIdentity,
): ParkingJamGeneratedProblem {
  validateIdentity(identity);
  const board = candidateAtAttempt(identity);
  if (!board)
    throw new Error(
      "Parking jam problem identity does not reference a valid problem",
    );
  return createGeneratedProblem(identity, board);
}

export function generateParkingJamProblem(
  options: ParkingJamGeneratorOptions,
): ParkingJamGeneratedProblem {
  const conditions: ParkingJamGenerationConditions = {
    width: options.width,
    height: options.height,
    vehicleCount: options.vehicleCount,
    roadOpeningCount: options.roadOpeningCount,
    roadOpeningSpan: options.roadOpeningSpan,
    fixedAreaCount: options.fixedAreaCount,
    fixedAreaLength: options.fixedAreaLength,
    blockingPlacementProbability: options.blockingPlacementProbability ?? 0,
  };
  validateConditions(conditions);
  const maximumAttempts = options.maximumAttempts ?? 100;
  validateMaximumAttempts(maximumAttempts);
  const random = createGeneratorRandom(options.seed, conditions);

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const board = createCandidate(conditions, random);
    if (!board) continue;
    const identity: ParkingJamProblemIdentity = {
      generatorVersion: PARKING_JAM_GENERATOR_VERSION,
      seed: options.seed,
      conditions,
      generationAttempt: attempt,
    };
    const generated = createGeneratedProblem(identity, board);
    const candidate: ParkingJamGeneratedCandidate = {
      attempt,
      board,
      solvabilityAnalysis: generated.solvabilityAnalysis,
      difficultyAnalysis: generated.difficultyAnalysis,
    };
    if (options.acceptCandidate && !options.acceptCandidate(candidate))
      continue;
    return generated;
  }

  throw new ParkingJamGenerationExhaustedError(maximumAttempts);
}
