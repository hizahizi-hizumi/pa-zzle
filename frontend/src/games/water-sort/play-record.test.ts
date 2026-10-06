import {
  createWaterSortPlayRecord,
  getWaterSortPlayRecordCompletionMoveCount,
  getWaterSortPlayRecordScore,
  getWaterSortPlayRecordTimeDelta,
  isWaterSortPlayRecord,
  restoreWaterSortRecordedResult,
  waterSortPlayRecordDefinition,
} from "@/games/water-sort/play-record";
import type { PlayRecord } from "@/records/play-record";

function createRecord() {
  return createWaterSortPlayRecord({
    difficulty: "3",
    problemIdentity: {
      generatorVersion: "1",
      seed: "water-sort-seed",
      conditions: { colorCount: 6, capacity: 4, emptyBottleCount: 2 },
      generationAttempt: 1,
    },
    startedAt: 1_000,
    completedAt: 66_000,
    result: {
      elapsedMs: 65_000,
      moveCount: 14,
      completionMoveCount: 12,
      undoCount: 2,
      restartCount: 0,
      optimalMoveCount: 10,
    },
  });
}

test("評価値を保存せず評価元の事実だけを保存用記録へ写すこと", () => {
  const record = createRecord();

  const performance = record.payload.performance;

  expect(record.payloadVersion).toBe(2);
  expect(performance).toEqual({
    elapsedMs: 65_000,
    moveCount: 14,
    completionMoveCount: 12,
    undoCount: 2,
    restartCount: 0,
    optimalMoveCount: 10,
  });
  expect(Object.hasOwn(performance, "score")).toBe(false);
  expect(Object.hasOwn(performance, "moveDelta")).toBe(false);
});

test("保存した事実から現在のプレイ評価を導出すること", () => {
  const record = createRecord();

  const score = getWaterSortPlayRecordScore(record);

  expect(score).toBe(87);
});

test("問題ごとの基準時間との差を比較指標として導出すること", () => {
  const record = createRecord();

  const timeDelta = getWaterSortPlayRecordTimeDelta(record);

  expect(timeDelta).toBe(1_000);
});

test("同じ開始条件を自己ベストの比較単位として扱うこと", () => {
  const record = createRecord();

  const comparisonKey = waterSortPlayRecordDefinition.getComparisonKey(record);

  expect(comparisonKey).toBe("3");
});

test("やり直しのない旧記録は待った回数からクリア手数を復元して再評価すること", () => {
  const legacyRecord: PlayRecord = {
    id: "legacy-without-restart",
    gameId: "water-sort",
    startedAt: 1_000,
    completedAt: 66_000,
    payloadVersion: 1,
    payload: {
      difficulty: "normal",
      problemIdentity: {
        generatorVersion: "1",
        seed: "legacy-seed",
        conditions: { colorCount: 6, capacity: 4, emptyBottleCount: 2 },
        generationAttempt: 1,
      },
      performance: {
        elapsedMs: 65_000,
        moveCount: 14,
        undoCount: 2,
        restartCount: 0,
        optimalMoveCount: 10,
      },
    },
  };

  const completionMoveCount =
    getWaterSortPlayRecordCompletionMoveCount(legacyRecord);
  const score = getWaterSortPlayRecordScore(legacyRecord);

  expect(isWaterSortPlayRecord(legacyRecord)).toBe(true);
  expect(completionMoveCount).toBe(12);
  expect(score).toBe(87);
});

test("やり直しで失われた手数を復元できない旧記録は評価を推測しないこと", () => {
  const legacyRecord: PlayRecord = {
    id: "legacy-with-restart",
    gameId: "water-sort",
    startedAt: 1_000,
    completedAt: 66_000,
    payloadVersion: 1,
    payload: {
      difficulty: "normal",
      problemIdentity: {
        generatorVersion: "1",
        seed: "legacy-seed",
        conditions: { colorCount: 6, capacity: 4, emptyBottleCount: 2 },
        generationAttempt: 1,
      },
      performance: {
        elapsedMs: 65_000,
        moveCount: 14,
        undoCount: 2,
        restartCount: 1,
        optimalMoveCount: 10,
      },
    },
  };
  const scoreMetric = waterSortPlayRecordDefinition.personalBestMetrics.find(
    (metric) => metric.id === "play-score",
  );

  const score = getWaterSortPlayRecordScore(legacyRecord);
  const metricValue = scoreMetric?.getValue(legacyRecord);

  expect(isWaterSortPlayRecord(legacyRecord)).toBe(true);
  expect(score).toBeNull();
  expect(metricValue).toBeNull();
});

describe("restoreWaterSortRecordedResult", () => {
  const record = createRecord();

  describe("今の版の記録の場合", () => {
    test("記録の成績・最短手数・色数から結果を作り直すこと", () => {
      const recorded = restoreWaterSortRecordedResult(record);

      expect(recorded).toMatchObject({
        difficulty: "3",
        problemIdentity: record.payload.problemIdentity,
        result: {
          elapsedMs: 65_000,
          moveCount: 14,
          completionMoveCount: 12,
          undoCount: 2,
          restartCount: 0,
          optimalMoveCount: 10,
          backtrackMoveCount: 2,
          timeDeltaMs: 1_000,
          colorCount: 6,
          score: { total: 87 },
        },
      });
    });
  });

  describe("以前の難易度区分の記録の場合", () => {
    const unrestorableRecord = {
      ...record,
      payload: { ...record.payload, difficulty: "normal" },
    };

    test("null を返すこと", () => {
      const recorded = restoreWaterSortRecordedResult(unrestorableRecord);

      expect(recorded).toBeNull();
    });
  });
});

describe("生成器の版が今と違う記録の場合", () => {
  const current = createRecord();
  const record: PlayRecord = {
    ...current,
    payload: {
      ...current.payload,
      problemIdentity: {
        generatorVersion: "0",
        seed: "older-generator-seed",
        conditions: { colorCount: 6 },
      },
    },
  };

  test("記録として読み込み、今の評価規則で評価すること", () => {
    const accepted = isWaterSortPlayRecord(record);
    const score = getWaterSortPlayRecordScore(record);

    expect(accepted).toBe(true);
    expect(score).toBe(getWaterSortPlayRecordScore(current));
  });

  test("結果画面に出す内容を作り直さないこと", () => {
    const restored = restoreWaterSortRecordedResult(record);

    expect(restored).toBeNull();
  });
});
