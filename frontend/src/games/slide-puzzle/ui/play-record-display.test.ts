import { createSlidePuzzlePlayRecord } from "@/games/slide-puzzle/play-record";
import { slidePuzzlePlayRecordDisplay } from "@/games/slide-puzzle/ui/play-record-display";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";

const record = createSlidePuzzlePlayRecord({
  difficulty: "3",
  problemIdentity: {
    generatorVersion: "1",
    seed: "fp30-0",
    conditions: { size: 4, scrambleLength: 30 },
  },
  startedAt: 1_000,
  completedAt: 81_000,
  result: {
    elapsedMs: 80_000,
    moveCount: 42,
    completionMoveCount: 34,
    slideCount: 25,
    restartCount: 1,
    optimalMoveCount: 30,
  },
});

function getFormattedMetric(metricId: string): string | null {
  const metricDisplay = slidePuzzlePlayRecordDisplay.metrics.find(
    (metric) => metric.id === metricId,
  );
  const value = getPlayRecordMetricValue(
    record,
    slidePuzzlePlayRecordDisplay.definition,
    metricId,
  );
  return metricDisplay && value !== null
    ? metricDisplay.formatValue(value)
    : null;
}

describe("slidePuzzlePlayRecordDisplay", () => {
  test("履歴と推移に共通の比較指標を表示できること", () => {
    const score = getFormattedMetric("play-score");
    const timeDelta = getFormattedMetric("time-delta-ms");
    const moveDelta = getFormattedMetric("move-delta");

    expect(score).toBe("77点");
    expect(timeDelta).toBe("+00:10");
    expect(moveDelta).toBe("+12");
  });

  const comparisonLabelCases = [
    ["1", "レベル 1"],
    ["5", "レベル 5"],
    ["normal", null],
  ] as const;

  test.each(comparisonLabelCases)(
    "比較条件 %s を利用者向けラベル %s へ変換すること",
    (key, expected) => {
      const label = slidePuzzlePlayRecordDisplay.getComparisonLabel(key);

      expect(label).toBe(expected);
    },
  );
});
