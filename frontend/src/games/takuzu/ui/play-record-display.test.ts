import { createTakuzuPlayRecord } from "@/games/takuzu/play-record";
import { createTakuzuProblemIdentity } from "@/games/takuzu/problem/problem";
import { takuzuPlayRecordDisplay } from "@/games/takuzu/ui/play-record-display";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";

// 基準時間 10 + 46×2 + 18×3 + 2×10 = 176秒を 220秒で、置き直し1回で解いた記録。
const record = createTakuzuPlayRecord({
  difficulty: "4",
  problemIdentity: createTakuzuProblemIdentity("duplicate-avoidance", 2, 160),
  workload: { emptyCellCount: 46, roundCount: 18, lineReadingRoundCount: 2 },
  startedAt: 1_000,
  completedAt: 221_000,
  result: {
    elapsedMs: 220_000,
    correctionCount: 1,
    restartCount: 0,
    inputCount: 70,
  },
});

function getFormattedMetric(metricId: string): string | null {
  const metricDisplay = takuzuPlayRecordDisplay.metrics.find(
    (metric) => metric.id === metricId,
  );
  const value = getPlayRecordMetricValue(
    record,
    takuzuPlayRecordDisplay.definition,
    metricId,
  );
  return metricDisplay && value !== null
    ? metricDisplay.formatValue(value)
    : null;
}

describe("takuzuPlayRecordDisplay", () => {
  test("自己ベストで比べる指標をすべて表示できること", () => {
    const metricIds = takuzuPlayRecordDisplay.metrics.map(({ id }) => id);

    expect(metricIds).toEqual(
      takuzuPlayRecordDisplay.definition.personalBestMetrics.map(
        ({ id }) => id,
      ),
    );
  });

  const formattedMetricCases = [
    ["play-score", "85点"],
    ["time-delta-ms", "+00:44"],
    ["correction-count", "1回"],
  ] as const;

  test.each(formattedMetricCases)(
    "%s を利用者向けの値 %s で表示すること",
    (metricId, expected) => {
      const formatted = getFormattedMetric(metricId);

      expect(formatted).toBe(expected);
    },
  );

  const comparisonLabelCases = [
    ["1", "難易度 1"],
    ["5", "難易度 5"],
    ["easy", null],
  ] as const;

  test.each(comparisonLabelCases)(
    "比較条件 %s を利用者向けラベル %s へ変換すること",
    (comparisonKey, expected) => {
      const label = takuzuPlayRecordDisplay.getComparisonLabel(comparisonKey);

      expect(label).toBe(expected);
    },
  );
});
