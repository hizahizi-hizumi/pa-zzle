import { PARKING_JAM_DIFFICULTY_MODEL_VERSION } from "@/games/parking-jam/difficulty";
import {
  createParkingJamPlayAttempt,
  createParkingJamPlayAttemptProgress,
  isParkingJamPlayAttempt,
  parkingJamPlayAttemptDefinition,
} from "@/games/parking-jam/play-attempt";
import {
  createParkingJamPlayRecord,
  parkingJamPlayRecordDefinition,
} from "@/games/parking-jam/play-record";
import type { ParkingJamProblem } from "@/games/parking-jam/problem/problem";
import { createParkingJamSession } from "@/games/parking-jam/session/session";
import { getPlayAttemptStatus, type PlayAttempt } from "@/records/play-attempt";

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

describe("parkingJamPlayAttemptDefinition", () => {
  const abandoned = {
    ...attempt,
    abandonment: {
      abandonedAt: 41_000,
      progress: createParkingJamPlayAttemptProgress(session, 41_000),
    },
  };
  // 保存先から読み戻したときと同じく、JSON を経由した値で確かめる。
  const stored: PlayAttempt = JSON.parse(JSON.stringify(abandoned));

  test("保存した開始記録と離脱を読み戻せること", () => {
    expect(isParkingJamPlayAttempt(JSON.parse(JSON.stringify(attempt)))).toBe(
      true,
    );
    expect(isParkingJamPlayAttempt(stored)).toBe(true);
  });

  test("開始条件から完了記録と同じ比較キーを返すこと", () => {
    const comparisonKey =
      parkingJamPlayAttemptDefinition.getComparisonKey(stored);

    expect(comparisonKey).not.toBeNull();
    expect(comparisonKey).toBe(
      parkingJamPlayRecordDefinition.getComparisonKey(record),
    );
  });

  test("離れた時点の進み具合を返し、離脱していない試行では返さないこと", () => {
    const progressOf = (value: PlayAttempt) =>
      Object.fromEntries(
        parkingJamPlayAttemptDefinition.progress.map(({ id, getValue }) => [
          id,
          getValue(value),
        ]),
      );

    expect(progressOf(stored)).toEqual({
      "elapsed-ms": 40_000,
      "failed-move-count": 1,
    });
    expect(
      Object.values(progressOf(attempt)).every((value) => value === null),
    ).toBe(true);
  });

  test.each([
    ["未知の版の", { ...stored, payloadVersion: 2 }],
    ["別のゲームの", { ...stored, gameId: "other-game" }],
    [
      "読めない開始条件の",
      { ...stored, start: { ...abandoned.start, difficulty: "unknown" } },
    ],
    [
      "読めない進み具合の",
      {
        ...stored,
        abandonment: { abandonedAt: 41_000, progress: { elapsedMs: -1 } },
      },
    ],
  ])("%s試行を読まないこと", (_, value) => {
    expect(isParkingJamPlayAttempt(value)).toBe(false);
    expect(parkingJamPlayAttemptDefinition.getComparisonKey(value)).toBeNull();
  });
});
