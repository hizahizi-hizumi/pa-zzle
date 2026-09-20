import { createNanpurePlayRecord } from "@/games/nanpure/play-record";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";

import { nanpurePlayRecordDisplay } from "./play-record-display";

const record = createNanpurePlayRecord({
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

function getFormattedMetric(metricId: string): string | null {
  const metricDisplay = nanpurePlayRecordDisplay.metrics.find(
    (metric) => metric.id === metricId,
  );
  const value = getPlayRecordMetricValue(
    record,
    nanpurePlayRecordDisplay.definition,
    metricId,
  );
  return metricDisplay && value !== null
    ? metricDisplay.formatValue(value)
    : null;
}

describe("nanpurePlayRecordDisplay", () => {
  test("履歴と推移に共通の比較指標を表示できること", () => {
    const score = getFormattedMetric("play-score");
    const elapsed = getFormattedMetric("elapsed-ms");
    const mistakes = getFormattedMetric("mistake-count");

    expect(score).toBe("91点");
    expect(elapsed).toBe("02:00");
    expect(mistakes).toBe("1回");
  });

  test("比較条件を利用者向けラベルへ変換すること", () => {
    const label = nanpurePlayRecordDisplay.getComparisonLabel("normal");

    expect(label).toBe("ふつう");
  });
});
