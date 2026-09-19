import { expect, test } from "vitest";

import { createWaterSortPlayRecord } from "@/games/water-sort/play-record";

import { waterSortPlayRecordDisplay } from "./play-record-display";

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

test("履歴にプレイ評価とゲーム固有指標を表示すること", () => {
  const record = createRecord();

  const summary = waterSortPlayRecordDisplay.getSummary(record);

  expect(summary).toEqual({
    primaryMetric: { label: "プレイ評価", value: "83点" },
    detailMetrics: [
      { label: "時間", value: "01:00" },
      { label: "手数", value: "12" },
      { label: "最短との差", value: "+2" },
    ],
  });
});

test("比較条件を利用者向けラベルへ変換すること", () => {
  const record = createRecord();

  const label = waterSortPlayRecordDisplay.getComparisonLabel(record);

  expect(label).toBe("ふつう");
});
