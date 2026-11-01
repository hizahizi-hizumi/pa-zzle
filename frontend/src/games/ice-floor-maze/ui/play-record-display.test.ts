import { createIceFloorMazePlayRecord } from "@/games/ice-floor-maze/play-record";
import { iceFloorMazePlayRecordDisplay } from "@/games/ice-floor-maze/ui/play-record-display";
import { getPlayRecordMetricValue } from "@/records/play-record-definition";

const record = createIceFloorMazePlayRecord({
  difficulty: "4",
  problemIdentity: {
    generatorVersion: "2",
    seed: "0g050005000000i10f00g1051100ff15005100105016105060-32-48",
    conditions: { width: 10, height: 10 },
  },
  startedAt: 1_000,
  completedAt: 68_500,
  result: {
    elapsedMs: 67_500,
    moveCount: 20,
    undoCount: 2,
    restartCount: 1,
    optimalMoveCount: 15,
  },
});

function getFormattedMetric(metricId: string): string | null {
  const metricDisplay = iceFloorMazePlayRecordDisplay.metrics.find(
    (metric) => metric.id === metricId,
  );
  const value = getPlayRecordMetricValue(
    record,
    iceFloorMazePlayRecordDisplay.definition,
    metricId,
  );
  return metricDisplay && value !== null
    ? metricDisplay.formatValue(value)
    : null;
}

describe("iceFloorMazePlayRecordDisplay", () => {
  test("履歴と推移に共通の比較指標を表示できること", () => {
    const score = getFormattedMetric("play-score");
    const timeDelta = getFormattedMetric("time-delta-ms");
    const moveDelta = getFormattedMetric("move-delta");

    expect(score).toBe("78点");
    expect(timeDelta).toBe("+00:10");
    expect(moveDelta).toBe("+5");
  });

  const comparisonLabelCases = [
    ["1", "レベル 1"],
    ["5", "レベル 5"],
    ["normal", null],
  ] as const;

  test.each(comparisonLabelCases)(
    "比較条件 %s を利用者向けラベル %s へ変換すること",
    (key, expected) => {
      const label = iceFloorMazePlayRecordDisplay.getComparisonLabel(key);

      expect(label).toBe(expected);
    },
  );
});
