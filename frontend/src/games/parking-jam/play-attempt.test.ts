import { PARKING_JAM_DIFFICULTY_MODEL_VERSION } from "@/games/parking-jam/difficulty";
import {
  createParkingJamPlayAttempt,
  createParkingJamPlayAttemptProgress,
} from "@/games/parking-jam/play-attempt";
import { createParkingJamPlayRecord } from "@/games/parking-jam/play-record";
import type { ParkingJamProblem } from "@/games/parking-jam/problem/problem";
import { createParkingJamSession } from "@/games/parking-jam/session/session";
import { getPlayAttemptStatus } from "@/records/play-attempt";

const problemIdentity = {
  generatorVersion: "2",
  seed: "record-seed",
  conditions: {
    width: 8,
    height: 8,
    vehicleCount: 14,
    roadOpeningCount: 4,
    roadOpeningSpan: 2,
    fixedAreaCount: 2,
    fixedAreaLength: 2,
    blockingPlacementProbability: 0,
  },
  generationAttempt: 2,
} as const;

const attempt = createParkingJamPlayAttempt({
  difficulty: "3",
  problemIdentity,
  startedAt: 1_000,
});

const problem: ParkingJamProblem = {
  board: {
    width: 5,
    height: 5,
    vehicles: [
      { id: "a", row: 1, column: 0, orientation: "horizontal", length: 2 },
    ],
    fixedAreas: [],
    roadOpenings: [{ side: "right", startOffset: 1, length: 1 }],
  },
};
const session = {
  ...createParkingJamSession(problem, 1_000),
  moveAttemptCount: 5,
  successfulMoveCount: 4,
  failedMoveCount: 1,
  undoCount: 2,
  restartCount: 1,
};

test("開始条件だけを持つ開始記録を作ること", () => {
  expect(attempt).toEqual({
    id: "parking-jam:1000",
    gameId: "parking-jam",
    startedAt: 1_000,
    payloadVersion: 1,
    start: {
      difficulty: "3",
      difficultyModelVersion: PARKING_JAM_DIFFICULTY_MODEL_VERSION,
      problemIdentity,
    },
    abandonment: null,
  });
  expect(attempt.start.problemIdentity).not.toBe(problemIdentity);
});

test("同じ時刻に始めたプレイの完了記録と突き合わせられること", () => {
  const record = createParkingJamPlayRecord({
    difficulty: "3",
    problemIdentity,
    startedAt: 1_000,
    completedAt: 200_000,
    speedReference: { vehicleCount: 14, initialBlockedVehicleCount: 6 },
    result: {
      elapsedMs: 90_000,
      moveAttemptCount: 16,
      successfulMoveCount: 15,
      failedMoveCount: 1,
      undoCount: 1,
      restartCount: 0,
    },
  });

  expect(getPlayAttemptStatus(attempt, [record])).toBe("cleared");
});

test("離れた時点までの実測値を進み具合にすること", () => {
  const progress = createParkingJamPlayAttemptProgress(session, 41_000);

  expect(progress).toEqual({
    elapsedMs: 40_000,
    moveAttemptCount: 5,
    successfulMoveCount: 4,
    failedMoveCount: 1,
    undoCount: 2,
    restartCount: 1,
  });
});
