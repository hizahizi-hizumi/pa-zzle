import { expect, test } from "vitest";

import {
  createNanpurePlayRecord,
  nanpurePlayRecordDefinition,
} from "./play-record";

function createRecord() {
  return createNanpurePlayRecord({
    difficulty: "normal",
    problemIdentity: {
      generatorVersion: "1",
      seed: "nanpure-seed",
      conditions: { clueCount: 32 },
      generationAttempt: 1,
    },
    startedAt: 1_000,
    completedAt: 121_000,
    result: {
      elapsedMs: 120_000,
      mistakeCount: 1,
      undoCount: 2,
      restartCount: 0,
    },
  });
}

test("完了プレイの事実だけを保存用記録へ写すこと", () => {
  const record = createRecord();

  const payload = record.payload;

  expect(payload).toEqual({
    difficulty: "normal",
    problemIdentity: {
      generatorVersion: "1",
      seed: "nanpure-seed",
      conditions: { clueCount: 32 },
      generationAttempt: 1,
    },
    performance: {
      elapsedMs: 120_000,
      mistakeCount: 1,
      undoCount: 2,
      restartCount: 0,
    },
  });
  expect(Object.hasOwn(payload.performance, "score")).toBe(false);
});

test("保存した事実から現在のプレイ評価を導出すること", () => {
  const record = createRecord();

  const summary = nanpurePlayRecordDefinition.getSummary(record);

  expect(summary?.primaryMetric).toEqual({
    label: "プレイ評価",
    value: "91点",
  });
});

test("同じ開始条件を自己ベストの比較単位として扱うこと", () => {
  const record = createRecord();

  const comparisonGroup =
    nanpurePlayRecordDefinition.getComparisonGroup(record);

  expect(comparisonGroup).toEqual({ key: "normal", label: "ふつう" });
});
