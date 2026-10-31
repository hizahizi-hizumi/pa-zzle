import {
  _private,
  createIceFloorMazePlayRecord,
  iceFloorMazePlayRecordDefinition,
  isIceFloorMazePlayRecord,
  restoreIceFloorMazeRecordedResult,
} from "@/games/ice-floor-maze/play-record";
import type { PlayRecord } from "@/records/play-record";

const {
  getIceFloorMazePlayRecordMoveDelta,
  getIceFloorMazePlayRecordScore,
  getIceFloorMazePlayRecordTimeDelta,
} = _private;

// 問題集のレベル4 の代表問題（10×13、最短6手）。基準時間は 130マス × 0.2秒 + 6手 × 2.5秒 = 41秒。
const seed = "048052444a402020c84028080600a1218-90-103";
const record = createIceFloorMazePlayRecord({
  difficulty: "4",
  problemIdentity: {
    generatorVersion: "1",
    seed,
    conditions: { width: 10, height: 13 },
  },
  startedAt: 1_000,
  completedAt: 52_000,
  result: {
    elapsedMs: 51_000,
    moveCount: 9,
    undoCount: 2,
    restartCount: 1,
    optimalMoveCount: 6,
  },
});

function withPerformance(performance: Record<string, unknown>): PlayRecord {
  return {
    ...record,
    payload: {
      ...record.payload,
      performance: { ...record.payload.performance, ...performance },
    },
  };
}

test("評価値を保存せず評価元の事実と最短手数だけを保存用記録へ写すこと", () => {
  const performance = record.payload.performance;

  expect(record.id).toBe(`ice-floor-maze:1000:52000:${seed}`);
  expect(record.payloadVersion).toBe(1);
  expect(performance).toEqual({
    elapsedMs: 51_000,
    moveCount: 9,
    undoCount: 2,
    restartCount: 1,
    optimalMoveCount: 6,
  });
  expect(Object.hasOwn(performance, "score")).toBe(false);
  expect(Object.hasOwn(performance, "moveDelta")).toBe(false);
});

test("保存した事実から現在のプレイ評価と比較指標を導出すること", () => {
  const score = getIceFloorMazePlayRecordScore(record);
  const timeDelta = getIceFloorMazePlayRecordTimeDelta(record);
  const moveDelta = getIceFloorMazePlayRecordMoveDelta(record);

  expect(score).toBe(70);
  expect(timeDelta).toBe(10_000);
  expect(moveDelta).toBe(3);
});

test("難易度を自己ベストの比較単位として扱うこと", () => {
  const comparisonKey =
    iceFloorMazePlayRecordDefinition.getComparisonKey(record);

  expect(comparisonKey).toBe("4");
});

describe("isIceFloorMazePlayRecord", () => {
  test("保存用記録を氷の床迷路の記録として認めること", () => {
    const recognized = isIceFloorMazePlayRecord(record);

    expect(recognized).toBe(true);
  });

  const invalidRecords: [string, PlayRecord][] = [
    ["別のゲーム", { ...record, gameId: "slide-puzzle" }],
    ["未知の payload 版", { ...record, payloadVersion: 2 }],
    [
      "未知の難易度",
      { ...record, payload: { ...record.payload, difficulty: "6" } },
    ],
    [
      "難易度と違う盤面の形",
      { ...record, payload: { ...record.payload, difficulty: "1" } },
    ],
    [
      "盤面の形の欠落",
      {
        ...record,
        payload: {
          ...record.payload,
          problemIdentity: { generatorVersion: "1", seed, conditions: {} },
        },
      },
    ],
    ["総手数より多い待った", withPerformance({ undoCount: 10 })],
    ["総手数より多い最短手数", withPerformance({ optimalMoveCount: 10 })],
    ["最短手数の欠落", withPerformance({ optimalMoveCount: null })],
    ["負の経過時間", withPerformance({ elapsedMs: -1 })],
  ];

  test.each(invalidRecords)(
    "不正な記録を認めないこと: %s",
    (_name, invalid) => {
      const recognized = isIceFloorMazePlayRecord(invalid);
      const score = getIceFloorMazePlayRecordScore(invalid);

      expect(recognized).toBe(false);
      expect(score).toBeNull();
    },
  );
});

describe("restoreIceFloorMazeRecordedResult", () => {
  describe("今の版の記録の場合", () => {
    test("記録の成績・盤面の形・最短手数から結果を作り直すこと", () => {
      const recorded = restoreIceFloorMazeRecordedResult(record);

      expect(recorded).toMatchObject({
        difficulty: "4",
        problemIdentity: record.payload.problemIdentity,
        result: {
          elapsedMs: 51_000,
          moveCount: 9,
          undoCount: 2,
          restartCount: 1,
          boardShape: { width: 10, height: 13 },
          optimalMoveCount: 6,
          moveDelta: 3,
          speedRule: { fullScoreMs: 41_000, zeroScoreMs: 82_000 },
          timeDeltaMs: 10_000,
          score: { total: 70 },
        },
      });
    });
  });

  describe("別の版の記録の場合", () => {
    const unrestorableRecord = { ...record, payloadVersion: 2 };

    test("null を返すこと", () => {
      const recorded = restoreIceFloorMazeRecordedResult(unrestorableRecord);

      expect(recorded).toBeNull();
    });
  });
});

describe("生成器の版が今と違う記録の場合", () => {
  const olderRecord: PlayRecord = {
    ...record,
    payload: {
      ...record.payload,
      problemIdentity: {
        generatorVersion: "0",
        seed: "older-generator-seed",
        conditions: { width: 10, height: 13 },
      },
    },
  };

  test("記録として読み込み、記録の盤面の形で今の評価規則により評価すること", () => {
    const accepted = isIceFloorMazePlayRecord(olderRecord);
    const score = getIceFloorMazePlayRecordScore(olderRecord);
    const timeDelta = getIceFloorMazePlayRecordTimeDelta(olderRecord);

    expect(accepted).toBe(true);
    expect(score).toBe(70);
    expect(timeDelta).toBe(10_000);
  });

  test("結果画面に出す内容を作り直さないこと", () => {
    const restored = restoreIceFloorMazeRecordedResult(olderRecord);

    expect(restored).toBeNull();
  });
});
