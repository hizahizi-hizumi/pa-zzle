import { createWaterSortPlayRecord } from "@/games/water-sort/play-record";
import type { PlayRecord } from "@/records/play-record";

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

test("履歴に現在のプレイ評価とゲーム固有指標を表示すること", () => {
  const record = createRecord();

  const summary = waterSortPlayRecordDisplay.getSummary(record);

  expect(summary).toEqual({
    primaryMetric: { label: "プレイ評価", value: "87点" },
    detailMetrics: [
      { label: "時間", value: "01:05" },
      { label: "クリア手数", value: "12" },
      { label: "最短との差", value: "+2" },
    ],
  });
});

test("復元不能な旧記録は評価を推測せず保存済み事実を表示すること", () => {
  const record: PlayRecord = {
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

  const summary = waterSortPlayRecordDisplay.getSummary(record);

  expect(summary).toEqual({
    primaryMetric: { label: "プレイ評価", value: "再計算不可" },
    detailMetrics: [
      { label: "時間", value: "01:05" },
      { label: "総手数", value: "14" },
      { label: "最短", value: "10" },
    ],
  });
});

test("比較条件を利用者向けラベルへ変換すること", () => {
  const label = waterSortPlayRecordDisplay.getComparisonLabel("normal");

  expect(label).toBe("ふつう");
});
