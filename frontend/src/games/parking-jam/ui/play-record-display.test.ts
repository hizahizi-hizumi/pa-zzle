import { createParkingJamPlayRecord } from "@/games/parking-jam/play-record";
import { parkingJamPlayRecordDisplay } from "./play-record-display";

const record = createParkingJamPlayRecord({
  difficulty: "hard",
  problemIdentity: {
    generatorVersion: "1",
    seed: "display-seed",
    conditions: {
      width: 8,
      height: 8,
      vehicleCount: 14,
      obstacleCount: 4,
      exitProbability: 0.45,
      blockingPlacementProbability: 1,
    },
    generationAttempt: 3,
  },
  startedAt: 1_000,
  completedAt: 121_000,
  result: {
    elapsedMs: 120_000,
    moveAttemptCount: 16,
    successfulMoveCount: 14,
    failedMoveCount: 2,
    undoCount: 1,
    restartCount: 0,
  },
});

describe("parkingJamPlayRecordDisplay", () => {
  test("難易度を開始条件ラベルへ変換すること", () => {
    const label = parkingJamPlayRecordDisplay.getComparisonLabel("hard");

    expect(label).toBe("むずかしい");
  });

  test("記録一覧向けに評価点と主要成績を表示すること", () => {
    const summary = parkingJamPlayRecordDisplay.getSummary(record);

    expect(summary).toEqual({
      primaryMetric: { label: "スコア", value: "88点" },
      detailMetrics: [
        { label: "時間", value: "02:00" },
        { label: "ミス", value: "2" },
        { label: "待った", value: "1" },
        { label: "やり直し", value: "0" },
      ],
    });
  });
});
