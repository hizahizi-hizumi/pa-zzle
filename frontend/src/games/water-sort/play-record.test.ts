import { expect, test } from "vitest";

import type { PlayRecord } from "@/records/play-record";
import {
  createWaterSortPlayRecord,
  isWaterSortPlayRecord,
  waterSortPlayRecordDefinition,
} from "./play-record";

function createRecord() {
  return createWaterSortPlayRecord({
    difficulty: "normal",
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

  const summary = waterSortPlayRecordDefinition.getSummary(record);

  expect(summary?.primaryMetric).toEqual({
    label: "プレイ評価",
    value: "87点",
  });
  expect(summary?.detailMetrics).toContainEqual({
    label: "クリア手数",
    value: "12",
  });
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

  const summary = waterSortPlayRecordDefinition.getSummary(legacyRecord);

  expect(isWaterSortPlayRecord(legacyRecord)).toBe(true);
  expect(summary?.primaryMetric.value).toBe("87点");
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

  const summary = waterSortPlayRecordDefinition.getSummary(legacyRecord);
  const scoreMetric = waterSortPlayRecordDefinition.personalBestMetrics.find(
    (metric) => metric.id === "play-score",
  );

  expect(isWaterSortPlayRecord(legacyRecord)).toBe(true);
  expect(summary?.primaryMetric.value).toBe("再計算不可");
  expect(scoreMetric?.getValue(legacyRecord)).toBeNull();
});
