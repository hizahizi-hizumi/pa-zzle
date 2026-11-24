import { getPlayRecordMetricValue } from "@/features/records/play-record-definition";
import { createShuttleParkingPlayRecord } from "@/games/shuttle-parking/play-record";
import {
  decodeShuttleParkingPoolEntry,
  listShuttleParkingPoolEntries,
} from "@/games/shuttle-parking/problem/problem-pool";
import { shuttleParkingPlayRecordDisplay } from "@/games/shuttle-parking/ui/play-record-display";

const record = createShuttleParkingPlayRecord({
  difficulty: "2",
  problemIdentity: decodeShuttleParkingPoolEntry(
    listShuttleParkingPoolEntries("2")[0]!,
  ),
  speedReference: { carCount: 8, passengerCount: 21, trapWeight: 6 },
  startedAt: 1_000,
  completedAt: 91_000,
  result: {
    elapsedMs: 90_000,
    exitCount: 9,
    blockedExitCount: 0,
    trapCount: 1,
    undoCount: 1,
    restartCount: 0,
  },
});

function getFormattedMetric(metricId: string): string | null {
  const metricDisplay = shuttleParkingPlayRecordDisplay.metrics.find(
    (metric) => metric.id === metricId,
  );
  const value = getPlayRecordMetricValue(
    record,
    shuttleParkingPlayRecordDisplay.definition,
    metricId,
  );
  return metricDisplay && value !== null
    ? metricDisplay.formatValue(value)
    : null;
}

describe("shuttleParkingPlayRecordDisplay", () => {
  test.each([
    ["2", "レベル 2"],
    ["unknown", null],
  ] as const)("難易度 %s を %s と示すこと", (comparisonKey, expected) => {
    const label =
      shuttleParkingPlayRecordDisplay.getComparisonLabel(comparisonKey);

    expect(label).toBe(expected);
  });

  test("履歴と推移に共通の比較指標を表示できること", () => {
    const score = getFormattedMetric("play-score");
    const timeDelta = getFormattedMetric("time-delta-ms");
    const traps = getFormattedMetric("trap-count");

    expect(score).toBe("40点");
    expect(timeDelta).toBe("+00:46");
    expect(traps).toBe("1回");
  });
});
