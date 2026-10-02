import { createParkingJamPlayRecord } from "@/games/parking-jam/play-record";
import { parkingJamPlayRecordDisplay } from "@/games/parking-jam/ui/play-record-display";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";

const record = createParkingJamPlayRecord({
  difficulty: "5",
  problemIdentity: {
    generatorVersion: "2",
    seed: "display-seed",
    conditions: {
      width: 8,
      height: 8,
      vehicleCount: 14,
      roadOpeningCount: 4,
      roadOpeningSpan: 2,
      fixedAreaCount: 2,
      fixedAreaLength: 2,
      blockingPlacementProbability: 1,
    },
    generationAttempt: 3,
  },
  speedReference: { vehicleCount: 14, initialBlockedVehicleCount: 8 },
  startedAt: 1_000,
  completedAt: 121_000,
  result: {
    elapsedMs: 120_000,
    moveAttemptCount: 17,
    successfulMoveCount: 15,
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
  const comparisonLabelCases = [
    ["5", "レベル 5"],
    ["hard", "むずかしい"],
    ["unknown", null],
  ] as const;

  test.each(comparisonLabelCases)(
    "難易度を開始条件ラベルへ変換し旧3段階は旧ラベルのまま表示すること: %s",
    (comparisonKey, expected) => {
      const label =
        parkingJamPlayRecordDisplay.getComparisonLabel(comparisonKey);

      expect(label).toBe(expected);
    },
  );

  test("履歴と推移に共通の比較指標を表示できること", () => {
    const score = getFormattedMetric("play-score");
    const elapsed = getFormattedMetric("elapsed-ms");
    const failedMoves = getFormattedMetric("failed-move-count");

    expect(score).toBe("60点");
    expect(elapsed).toBe("02:00");
    expect(failedMoves).toBe("2回");
  });
});
