import { createNanpurePlayRecord } from "@/games/nanpure/play-record";

import { nanpurePlayRecordDisplay } from "./play-record-display";

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

test("履歴にスコアとゲーム固有指標を表示すること", () => {
  const record = createRecord();

  const summary = nanpurePlayRecordDisplay.getSummary(record);

  expect(summary).toEqual({
    primaryMetric: { label: "スコア", value: "91点" },
    detailMetrics: [
      { label: "時間", value: "02:00" },
      { label: "ミス", value: "1" },
      { label: "待った", value: "2" },
      { label: "やり直し", value: "0" },
    ],
  });
});

test("比較条件を利用者向けラベルへ変換すること", () => {
  const label = nanpurePlayRecordDisplay.getComparisonLabel("normal");

  expect(label).toBe("ふつう");
});
