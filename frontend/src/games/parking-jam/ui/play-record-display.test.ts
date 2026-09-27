import { createParkingJamPlayRecord } from "@/games/parking-jam/play-record";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";
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

function getFormattedMetric(metricId: string): string | null {
  const metricDisplay = parkingJamPlayRecordDisplay.metrics.find(
    (metric) => metric.id === metricId,
  );
  const value = getPlayRecordMetricValue(
    record,
    parkingJamPlayRecordDisplay.definition,
    metricId,
  );
  return metricDisplay && value !== null
    ? metricDisplay.formatValue(value)
    : null;
}

describe("parkingJamPlayRecordDisplay", () => {
  test("難易度を開始条件ラベルへ変換すること", () => {
    const label = parkingJamPlayRecordDisplay.getComparisonLabel("hard");

    expect(label).toBe("むずかしい");
  });

  test("履歴と推移に共通の比較指標を表示できること", () => {
    const score = getFormattedMetric("play-score");
    const elapsed = getFormattedMetric("elapsed-ms");
    const failedMoves = getFormattedMetric("failed-move-count");

    expect(score).toBe("88点");
    expect(elapsed).toBe("02:00");
    expect(failedMoves).toBe("2回");
  });
});
