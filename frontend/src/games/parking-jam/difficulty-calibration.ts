import { restoreParkingJamProblem } from "./problem/generator";
import {
  PARKING_JAM_GENERATOR_VERSION,
  type ParkingJamGeneratedProblem,
  type ParkingJamProblemIdentity,
} from "./problem/problem";

export const parkingJamDifficultyCalibrationCorpus = [
  {
    id: "small-deep",
    identity: {
      generatorVersion: PARKING_JAM_GENERATOR_VERSION,
      seed: "r3-small-deep-5",
      conditions: {
        width: 6,
        height: 6,
        vehicleCount: 8,
        roadOpeningCount: 2,
        roadOpeningSpan: 2,
        fixedAreaCount: 0,
        fixedAreaLength: 1,
        blockingPlacementProbability: 1,
      },
      generationAttempt: 10,
    },
  },
  {
    id: "large-shallow",
    identity: {
      generatorVersion: PARKING_JAM_GENERATOR_VERSION,
      seed: "r3-large-shallow-2",
      conditions: {
        width: 8,
        height: 8,
        vehicleCount: 14,
        roadOpeningCount: 4,
        roadOpeningSpan: 4,
        fixedAreaCount: 0,
        fixedAreaLength: 1,
        blockingPlacementProbability: 0,
      },
      generationAttempt: 1,
    },
  },
  {
    id: "dense-free",
    identity: {
      generatorVersion: PARKING_JAM_GENERATOR_VERSION,
      seed: "r3-dense-free-2",
      conditions: {
        width: 6,
        height: 6,
        vehicleCount: 10,
        roadOpeningCount: 4,
        roadOpeningSpan: 3,
        fixedAreaCount: 0,
        fixedAreaLength: 1,
        blockingPlacementProbability: 0,
      },
      generationAttempt: 1,
    },
  },
  {
    id: "sparse-bottleneck",
    identity: {
      generatorVersion: PARKING_JAM_GENERATOR_VERSION,
      seed: "r3-sparse-bottleneck-5",
      conditions: {
        width: 8,
        height: 8,
        vehicleCount: 8,
        roadOpeningCount: 2,
        roadOpeningSpan: 2,
        fixedAreaCount: 0,
        fixedAreaLength: 1,
        blockingPlacementProbability: 1,
      },
      generationAttempt: 1,
    },
  },
  {
    id: "few-exits-shallow",
    identity: {
      generatorVersion: PARKING_JAM_GENERATOR_VERSION,
      seed: "r3-few-exits-shallow-1",
      conditions: {
        width: 8,
        height: 8,
        vehicleCount: 10,
        roadOpeningCount: 2,
        roadOpeningSpan: 3,
        fixedAreaCount: 0,
        fixedAreaLength: 1,
        blockingPlacementProbability: 0,
      },
      generationAttempt: 1,
    },
  },
  {
    id: "many-exits-deep",
    identity: {
      generatorVersion: PARKING_JAM_GENERATOR_VERSION,
      seed: "r3-many-exits-deep-3",
      conditions: {
        width: 8,
        height: 8,
        vehicleCount: 12,
        roadOpeningCount: 4,
        roadOpeningSpan: 2,
        fixedAreaCount: 0,
        fixedAreaLength: 1,
        blockingPlacementProbability: 1,
      },
      generationAttempt: 5,
    },
  },
] as const satisfies readonly {
  id: string;
  identity: ParkingJamProblemIdentity;
}[];

export type ParkingJamDifficultyCalibrationProblemId =
  (typeof parkingJamDifficultyCalibrationCorpus)[number]["id"];

export const parkingJamDifficultyCalibrationComparisons = [
  {
    id: "scale-vs-structure",
    leftProblemId: "small-deep",
    rightProblemId: "large-shallow",
  },
  {
    id: "density-vs-bottleneck",
    leftProblemId: "dense-free",
    rightProblemId: "sparse-bottleneck",
  },
  {
    id: "openings-vs-dependency",
    leftProblemId: "few-exits-shallow",
    rightProblemId: "many-exits-deep",
  },
  {
    id: "constraint-boundary",
    leftProblemId: "small-deep",
    rightProblemId: "few-exits-shallow",
  },
  {
    id: "visual-load-boundary",
    leftProblemId: "large-shallow",
    rightProblemId: "dense-free",
  },
] as const satisfies readonly {
  id: string;
  leftProblemId: ParkingJamDifficultyCalibrationProblemId;
  rightProblemId: ParkingJamDifficultyCalibrationProblemId;
}[];

export type ParkingJamDifficultyCalibrationComparison =
  (typeof parkingJamDifficultyCalibrationComparisons)[number];

export function restoreParkingJamDifficultyCalibrationProblem(
  problemId: ParkingJamDifficultyCalibrationProblemId,
): ParkingJamGeneratedProblem {
  const entry = parkingJamDifficultyCalibrationCorpus.find(
    (candidate) => candidate.id === problemId,
  );
  if (!entry)
    throw new Error(`Unknown parking jam calibration problem: ${problemId}`);
  return restoreParkingJamProblem(entry.identity);
}
