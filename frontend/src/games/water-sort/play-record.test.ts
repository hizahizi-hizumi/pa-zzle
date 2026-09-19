import { expect, test } from "vitest";

import {
  createWaterSortPlayRecord,
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
    completedAt: 61_000,
    result: {
      elapsedMs: 60_000,
      moveCount: 12,
      undoCount: 1,
      restartCount: 0,
      optimalMoveCount: 10,
      moveDelta: 2,
      score: 83,
    },
  });
}

test("評価値を保存せず評価元の事実だけを保存用記録へ写すこと", () => {
  const record = createRecord();

  const performance = record.payload.performance;

  expect(performance).toEqual({
    elapsedMs: 60_000,
    moveCount: 12,
    undoCount: 1,
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
    value: "83点",
  });
});
