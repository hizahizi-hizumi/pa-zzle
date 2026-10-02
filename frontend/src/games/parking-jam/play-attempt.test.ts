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

const attemptInput: Parameters<typeof createParkingJamPlayAttempt>[0] = {
  difficulty: "3",
  problemIdentity,
  startedAt: 1_000,
};

const attempt = createParkingJamPlayAttempt(attemptInput);

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

describe("createParkingJamPlayAttempt", () => {
  test("開始条件だけを持つ開始記録を作ること", () => {
    const created = createParkingJamPlayAttempt(attemptInput);

    expect(created).toEqual({
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
    expect(created.start.problemIdentity).not.toBe(problemIdentity);
  });

  test("同じ時刻に始めたプレイの完了記録と突き合わせられること", () => {
    const created = createParkingJamPlayAttempt(attemptInput);
    const status = getPlayAttemptStatus(created, [record]);

    expect(status).toBe("cleared");
  });
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

function getProgressValues(value: PlayAttempt) {
  return Object.fromEntries(
    parkingJamPlayAttemptDefinition.progress.map(({ id, getValue }) => [
      id,
      getValue(value),
    ]),
  );
}

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
  const storedStart: PlayAttempt = JSON.parse(JSON.stringify(attempt));
  const recordComparisonKey =
    parkingJamPlayRecordDefinition.getComparisonKey(record);
  const readableCases = [
    ["開始だけを記録した", storedStart],
    ["離脱を記録した", stored],
  ] as const;
  const unreadableCases = [
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
  ] as const;

  test.each(readableCases)("保存した%s試行を読み戻せること", (_, value) => {
    const readable = isParkingJamPlayAttempt(value);

    expect(readable).toBe(true);
  });

  test("開始条件から完了記録と同じ比較キーを返すこと", () => {
    const comparisonKey =
      parkingJamPlayAttemptDefinition.getComparisonKey(stored);

    expect(comparisonKey).not.toBeNull();
    expect(comparisonKey).toBe(recordComparisonKey);
  });

  test("離れた時点の進み具合を返すこと", () => {
    const progress = getProgressValues(stored);

    expect(progress).toEqual({
      "elapsed-ms": 40_000,
      "failed-move-count": 1,
    });
  });

  test("離脱していない試行では進み具合を返さないこと", () => {
    const progress = getProgressValues(storedStart);

    expect(Object.values(progress).filter((value) => value !== null)).toEqual(
      [],
    );
  });

  test.each(unreadableCases)(
    "%s試行を読まず、比較キーも返さないこと",
    (_, value) => {
      const readable = isParkingJamPlayAttempt(value);
      const comparisonKey =
        parkingJamPlayAttemptDefinition.getComparisonKey(value);

      expect(readable).toBe(false);
      expect(comparisonKey).toBeNull();
    },
  );
});
