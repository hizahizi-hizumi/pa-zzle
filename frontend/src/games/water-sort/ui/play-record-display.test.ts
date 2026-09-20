import { createWaterSortPlayRecord } from "@/games/water-sort/play-record";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";

import { waterSortPlayRecordDisplay } from "./play-record-display";

const record = createWaterSortPlayRecord({
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

  test("比較条件を利用者向けラベルへ変換すること", () => {
    const label = waterSortPlayRecordDisplay.getComparisonLabel("normal");

    expect(label).toBe("ふつう");
  });
});
