import {
  createProblemRandom,
  type ProblemRandom,
  shuffleProblemValues,
} from "@/games/problem-random";
import type { ProblemSeed } from "@/games/problem-seed";
import {
  createParkingJamInitialState,
  listParkingJamVehicleCells,
  PARKING_JAM_MAX_BOARD_SIZE,
  PARKING_JAM_VEHICLE_LENGTHS,
  type ParkingJamBoard,
  type ParkingJamCell,
  type ParkingJamExit,
  type ParkingJamOrientation,
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
  if (
    !Number.isInteger(conditions.vehicleCount) ||
    conditions.vehicleCount < 1
  ) {
    throw new RangeError("vehicleCount must be a positive integer");
  }
  if (
    !Number.isInteger(conditions.obstacleCount) ||
    conditions.obstacleCount < 0
  ) {
    throw new RangeError("obstacleCount must be a non-negative integer");
  }
  if (conditions.obstacleCount >= conditions.width * conditions.height) {
    throw new RangeError(
      "obstacleCount must leave at least one board cell available",
    );
  }
  if (
    !Number.isFinite(conditions.exitProbability) ||
    conditions.exitProbability <= 0 ||
    conditions.exitProbability > 1
  ) {
    throw new RangeError(
      "exitProbability must be greater than 0 and at most 1",
    );
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
      conditions.obstacleCount,
      conditions.exitProbability,
      conditions.blockingPlacementProbability,
    ].join(":"),
  );
}

function allCells(width: number, height: number): ParkingJamCell[] {
  return Array.from({ length: width * height }, (_, index) => ({
    row: Math.floor(index / width),
    column: index % width,
  }));
}

function createObstacles(
  conditions: ParkingJamGenerationConditions,
  random: ProblemRandom,
): ParkingJamCell[] {
  return shuffleProblemValues(
    allCells(conditions.width, conditions.height),
    random,
  ).slice(0, conditions.obstacleCount);
}

function createExits(
  conditions: ParkingJamGenerationConditions,
  random: ProblemRandom,
): ParkingJamExit[] {
  const candidates: ParkingJamExit[] = [];
  for (let row = 0; row < conditions.height; row += 1) {
    candidates.push(
      { side: "left", offset: row },
      { side: "right", offset: row },
    );
  }
  for (let column = 0; column < conditions.width; column += 1) {
    candidates.push(
      { side: "up", offset: column },
      { side: "down", offset: column },
    );
  }

  const exits = candidates.filter(() => random() < conditions.exitProbability);
  if (exits.length > 0) return exits;

  const fallbackIndex = Math.floor(random() * candidates.length);
  const fallback = candidates[fallbackIndex];
  return fallback ? [fallback] : [];
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
            cellsOverlap(cells, board.obstacles) ||
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
  const obstacles = createObstacles(conditions, random);
  const exits = createExits(conditions, random);
  const vehicles: ParkingJamVehicle[] = [];
  const boardBase = {
    width: conditions.width,
    height: conditions.height,
    obstacles,
    exits,
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
    obstacleCount: options.obstacleCount,
    exitProbability: options.exitProbability,
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
