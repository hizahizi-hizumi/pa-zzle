import { createHakoiriMusumePlayRecord } from "@/games/hakoiri-musume/play-record";
import { hakoiriMusumePlayRecordDisplay } from "@/games/hakoiri-musume/ui/play-record-display";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";

// 合意の易しい例（最短13手・準備6手）。基準時間は 57.5秒。
const record = createHakoiriMusumePlayRecord({
  difficulty: "1",
  problemIdentity: {
    generatorVersion: "1",
    seed: "vAAvwAAwv..vwhiws..s",
    conditions: {},
  },
  startedAt: 1_000,
  completedAt: 69_500,
  result: {
    elapsedMs: 68_500,
    moveCount: 20,
    completionMoveCount: 16,
    undoCount: 2,
    restartCount: 1,
    optimalMoveCount: 13,
    preparationLength: 6,
  },
});

function getFormattedMetric(metricId: string): string | null {
  const metricDisplay = hakoiriMusumePlayRecordDisplay.metrics.find(
    (metric) => metric.id === metricId,
  );
  const value = getPlayRecordMetricValue(
    record,
    hakoiriMusumePlayRecordDisplay.definition,
    metricId,
  );
  return metricDisplay && value !== null
    ? metricDisplay.formatValue(value)
    : null;
}

describe("hakoiriMusumePlayRecordDisplay", () => {
  test("履歴と推移に共通の比較指標を表示できること", () => {
    const score = getFormattedMetric("play-score");
    const timeDelta = getFormattedMetric("time-delta-ms");
    const moveDelta = getFormattedMetric("move-delta");

    // 効率 70 × 18 ÷ 25 = 50、速さ 30 × (1 − 10.5 ÷ 116) = 27
    expect(score).toBe("77点");
    expect(timeDelta).toBe("+00:10");
    expect(moveDelta).toBe("+7");
  });

  const comparisonLabelCases = [
    ["1", "レベル 1"],
    ["5", "レベル 5"],
    ["normal", null],
  ] as const;

  test.each(comparisonLabelCases)(
    "比較条件 %s を利用者向けラベル %s へ変換すること",
    (key, expected) => {
      const label = hakoiriMusumePlayRecordDisplay.getComparisonLabel(key);

      expect(label).toBe(expected);
    },
  );
});
