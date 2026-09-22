import type { ProblemSeed } from "@/games/problem-seed";
import { generateParkingJamProblem } from "../generator";
import type {
  ParkingJamGeneratedProblem,
  ParkingJamGenerationConditions,
} from "../problem";

const MAXIMUM_CANDIDATE_GENERATION_ATTEMPTS = 100;

export type ParkingJamDifficultyCandidateAxis =
  | "board-size"
  | "vehicle-count"
  | "road-opening-count"
  | "road-opening-span"
  | "fixed-area"
  | "blocking-placement";

type ParkingJamBoardSize = Pick<
  ParkingJamGenerationConditions,
  "width" | "height"
>;

type ParkingJamFixedAreaProfile = Pick<
  ParkingJamGenerationConditions,
  "fixedAreaCount" | "fixedAreaLength"
>;

export const PARKING_JAM_DIFFICULTY_CANDIDATE_AXES = {
  boardSizes: [
    { width: 6, height: 6 },
    { width: 6, height: 8 },
    { width: 8, height: 8 },
  ],
  vehicleCounts: [8, 11, 14],
  roadOpeningCounts: [3, 4],
  roadOpeningSpans: [2, 3],
  fixedAreas: [
    { fixedAreaCount: 0, fixedAreaLength: 1 },
    { fixedAreaCount: 1, fixedAreaLength: 2 },
  ],
  blockingPlacementProbabilities: [0, 0.5, 1],
} as const satisfies {
  boardSizes: readonly ParkingJamBoardSize[];
  vehicleCounts: readonly number[];
  roadOpeningCounts: readonly number[];
  roadOpeningSpans: readonly number[];
  fixedAreas: readonly ParkingJamFixedAreaProfile[];
  blockingPlacementProbabilities: readonly number[];
};

export type ParkingJamDifficultyCrossAxisCase = {
  id: string;
  axis: ParkingJamDifficultyCandidateAxis;
  variant: "lower" | "higher";
  seed: ProblemSeed;
  conditions: ParkingJamGenerationConditions;
};

function createCrossAxisPair(
  axis: ParkingJamDifficultyCandidateAxis,
  seed: ProblemSeed,
  lower: ParkingJamGenerationConditions,
  higher: ParkingJamGenerationConditions,
): readonly ParkingJamDifficultyCrossAxisCase[] {
  return [
    { id: `${axis}-lower`, axis, variant: "lower", seed, conditions: lower },
    { id: `${axis}-higher`, axis, variant: "higher", seed, conditions: higher },
  ];
}

export const PARKING_JAM_DIFFICULTY_CROSS_AXIS_CASES = [
  ...createCrossAxisPair(
    "board-size",
    "parking-jam-r3-cross-board-size",
    {
      width: 6,
      height: 6,
      vehicleCount: 8,
      roadOpeningCount: 3,
      roadOpeningSpan: 2,
      fixedAreaCount: 1,
      fixedAreaLength: 2,
      blockingPlacementProbability: 0.5,
    },
    {
      width: 8,
      height: 8,
      vehicleCount: 8,
      roadOpeningCount: 3,
      roadOpeningSpan: 2,
      fixedAreaCount: 1,
      fixedAreaLength: 2,
      blockingPlacementProbability: 0.5,
    },
  ),
  ...createCrossAxisPair(
    "vehicle-count",
    "parking-jam-r3-cross-vehicle-count",
    {
      width: 8,
      height: 8,
      vehicleCount: 8,
      roadOpeningCount: 4,
      roadOpeningSpan: 3,
      fixedAreaCount: 1,
      fixedAreaLength: 2,
      blockingPlacementProbability: 0.5,
    },
    {
      width: 8,
      height: 8,
      vehicleCount: 14,
      roadOpeningCount: 4,
      roadOpeningSpan: 3,
      fixedAreaCount: 1,
      fixedAreaLength: 2,
      blockingPlacementProbability: 0.5,
    },
  ),
  ...createCrossAxisPair(
    "road-opening-count",
    "parking-jam-r3-cross-road-opening-count",
    {
      width: 8,
      height: 8,
      vehicleCount: 11,
      roadOpeningCount: 3,
      roadOpeningSpan: 3,
      fixedAreaCount: 1,
      fixedAreaLength: 2,
      blockingPlacementProbability: 0.5,
    },
    {
      width: 8,
      height: 8,
      vehicleCount: 11,
      roadOpeningCount: 4,
      roadOpeningSpan: 3,
      fixedAreaCount: 1,
      fixedAreaLength: 2,
      blockingPlacementProbability: 0.5,
    },
  ),
  ...createCrossAxisPair(
    "road-opening-span",
    "parking-jam-r3-cross-road-opening-span",
    {
      width: 8,
      height: 8,
      vehicleCount: 11,
      roadOpeningCount: 4,
      roadOpeningSpan: 2,
      fixedAreaCount: 1,
      fixedAreaLength: 2,
      blockingPlacementProbability: 0.5,
    },
    {
      width: 8,
      height: 8,
      vehicleCount: 11,
      roadOpeningCount: 4,
      roadOpeningSpan: 3,
      fixedAreaCount: 1,
      fixedAreaLength: 2,
      blockingPlacementProbability: 0.5,
    },
  ),
  ...createCrossAxisPair(
    "fixed-area",
    "parking-jam-r3-cross-fixed-area",
    {
      width: 8,
      height: 8,
      vehicleCount: 11,
      roadOpeningCount: 4,
      roadOpeningSpan: 3,
      fixedAreaCount: 0,
      fixedAreaLength: 1,
      blockingPlacementProbability: 0.5,
    },
    {
      width: 8,
      height: 8,
      vehicleCount: 11,
      roadOpeningCount: 4,
      roadOpeningSpan: 3,
      fixedAreaCount: 1,
      fixedAreaLength: 2,
      blockingPlacementProbability: 0.5,
    },
  ),
  ...createCrossAxisPair(
    "blocking-placement",
    "parking-jam-r3-cross-blocking-placement",
    {
      width: 8,
      height: 8,
      vehicleCount: 11,
      roadOpeningCount: 4,
      roadOpeningSpan: 3,
      fixedAreaCount: 1,
      fixedAreaLength: 2,
      blockingPlacementProbability: 0,
    },
    {
      width: 8,
      height: 8,
      vehicleCount: 11,
      roadOpeningCount: 4,
      roadOpeningSpan: 3,
      fixedAreaCount: 1,
      fixedAreaLength: 2,
      blockingPlacementProbability: 1,
    },
  ),
] as const satisfies readonly ParkingJamDifficultyCrossAxisCase[];

export function listParkingJamDifficultyCandidateConditions(): ParkingJamGenerationConditions[] {
  const conditions: ParkingJamGenerationConditions[] = [];

  for (const boardSize of PARKING_JAM_DIFFICULTY_CANDIDATE_AXES.boardSizes) {
    for (const vehicleCount of PARKING_JAM_DIFFICULTY_CANDIDATE_AXES.vehicleCounts) {
      for (const roadOpeningCount of PARKING_JAM_DIFFICULTY_CANDIDATE_AXES.roadOpeningCounts) {
        for (const roadOpeningSpan of PARKING_JAM_DIFFICULTY_CANDIDATE_AXES.roadOpeningSpans) {
          for (const fixedArea of PARKING_JAM_DIFFICULTY_CANDIDATE_AXES.fixedAreas) {
            for (const blockingPlacementProbability of PARKING_JAM_DIFFICULTY_CANDIDATE_AXES.blockingPlacementProbabilities) {
              conditions.push({
                ...boardSize,
                vehicleCount,
                roadOpeningCount,
                roadOpeningSpan,
                ...fixedArea,
                blockingPlacementProbability,
              });
            }
          }
        }
      }
    }
  }

  return conditions;
}

export function generateParkingJamDifficultyCandidate(
  seed: ProblemSeed,
  conditions: ParkingJamGenerationConditions,
): ParkingJamGeneratedProblem {
  return generateParkingJamProblem({
    seed,
    ...conditions,
    maximumAttempts: MAXIMUM_CANDIDATE_GENERATION_ATTEMPTS,
  });
}
