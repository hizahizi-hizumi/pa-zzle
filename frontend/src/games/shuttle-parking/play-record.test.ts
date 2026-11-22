import type { PlayRecord } from "@/features/records/play-record";
import { getPlayRecordMetricValue } from "@/features/records/play-record-definition";
import {
  createShuttleParkingPlayRecord,
  getShuttleParkingPlayRecordScore,
  getShuttleParkingPlayRecordTimeDelta,
  isShuttleParkingPlayRecord,
  restoreShuttleParkingRecordedResult,
  shuttleParkingPlayRecordDefinition,
} from "@/games/shuttle-parking/play-record";
import {
  decodeShuttleParkingPoolEntry,
  listShuttleParkingPoolEntries,
} from "@/games/shuttle-parking/problem/problem-pool";

const problemIdentity = decodeShuttleParkingPoolEntry(
  listShuttleParkingPoolEntries("3")[0]!,
);
const record = createShuttleParkingPlayRecord({
  difficulty: "3",
  problemIdentity,
  speedReference: { carCount: 8, passengerCount: 21 },
  startedAt: 1_000,
  completedAt: 81_000,
  result: {
    elapsedMs: 80_000,
    exitCount: 11,
    blockedExitCount: 2,
    trapCount: 1,
    undoCount: 3,
    restartCount: 0,
  },
});

describe("createShuttleParkingPlayRecord", () => {
  test("問題とプレイの事実を今の版の記録として作ること", () => {
    expect(record).toMatchObject({
      gameId: "shuttle-parking",
      payloadVersion: 1,
      payload: {
        difficulty: "3",
        problemIdentity,
        problemFacts: { carCount: 8, passengerCount: 21 },
        performance: { trapCount: 1, exitCount: 11 },
      },
    });
    expect(isShuttleParkingPlayRecord(record)).toBe(true);
  });
});

describe("isShuttleParkingPlayRecord", () => {
  const invalidCases: readonly [string, PlayRecord][] = [
    ["別のゲーム", { ...record, gameId: "parking-jam" }],
    ["別の payload の版", { ...record, payloadVersion: 2 }],
    [
      "車の数より出庫が少ない",
      {
        ...record,
        payload: {
          ...record.payload,
          performance: { ...record.payload.performance, exitCount: 7 },
        },
      },
    ],
    [
      "レベルでない難易度",
      { ...record, payload: { ...record.payload, difficulty: "hard" } },
    ],
    [
      "問題の事実が無い",
      { ...record, payload: { ...record.payload, problemFacts: null } },
    ],
  ];

  test.each(invalidCases)("%s 記録を受け付けないこと", (_, value) => {
    const accepted = isShuttleParkingPlayRecord(value);

    expect(accepted).toBe(false);
  });
});

describe("restoreShuttleParkingRecordedResult", () => {
  test("記録の事実から結果を作り直すこと", () => {
    const restored = restoreShuttleParkingRecordedResult(record);

    expect(restored).toMatchObject({
      difficulty: "3",
      problemIdentity,
      result: { trapCount: 1, speedReference: { carCount: 8 } },
    });
    expect(restored?.result.score.total).toBe(
      getShuttleParkingPlayRecordScore(record),
    );
  });

  test("今の生成器で復元できない問題の記録には null を返すこと", () => {
    const restored = restoreShuttleParkingRecordedResult({
      ...record,
      payload: {
        ...record.payload,
        problemIdentity: {
          generatorVersion: "0",
          seed: "old",
          conditions: { size: 7 },
        },
      },
    });

    expect(restored).toBeNull();
  });
});

describe("shuttleParkingPlayRecordDefinition", () => {
  test("自己ベストの指標を記録の事実から求めること", () => {
    const values = ["play-score", "time-delta-ms", "trap-count"].map(
      (metricId) =>
        getPlayRecordMetricValue(
          record,
          shuttleParkingPlayRecordDefinition,
          metricId,
        ),
    );

    expect(values).toEqual([
      getShuttleParkingPlayRecordScore(record),
      getShuttleParkingPlayRecordTimeDelta(record),
      1,
    ]);
  });

  test("クリアの出来に時間と罠の回数を渡すこと", () => {
    const performance =
      shuttleParkingPlayRecordDefinition.getClearPerformance(record);

    expect(performance).toEqual({ elapsedMs: 80_000, mistakeCount: 1 });
  });
});
