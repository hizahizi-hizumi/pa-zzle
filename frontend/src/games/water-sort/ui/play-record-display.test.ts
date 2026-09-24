import { createWaterSortPlayRecord } from "@/games/water-sort/play-record";
import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";

const record = createWaterSortPlayRecord({
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

function getFormattedMetric(metricId: string): string | null {
  const metricDisplay = waterSortPlayRecordDisplay.metrics.find(
    (metric) => metric.id === metricId,
  );
  const value = getPlayRecordMetricValue(
    record,
    waterSortPlayRecordDisplay.definition,
    metricId,
  );
  return metricDisplay && value !== null
    ? metricDisplay.formatValue(value)
    : null;
}

describe("waterSortPlayRecordDisplay", () => {
  test("履歴と推移に共通の比較指標を表示できること", () => {
    const score = getFormattedMetric("play-score");
    const timeDelta = getFormattedMetric("time-delta-ms");
    const moveDelta = getFormattedMetric("move-delta");

    expect(score).toBe("87点");
    expect(timeDelta).toBe("+00:01");
    expect(moveDelta).toBe("+2");
  });

  test.each([
    ["3", "難易度 3"],
    ["normal", "ふつう"],
  ])("比較条件 %s を利用者向けラベル %s へ変換すること", (key, expected) => {
    const label = waterSortPlayRecordDisplay.getComparisonLabel(key);

    expect(label).toBe(expected);
  });
});
