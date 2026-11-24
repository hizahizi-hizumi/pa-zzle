import { getPlayRecordMetricValue } from "@/features/records/play-record-definition";
import { createSolitairePlayRecord } from "@/games/solitaire/play-record";
import {
  decodeSolitairePoolEntry,
  listSolitairePoolEntries,
} from "@/games/solitaire/problem/problem-pool";
import { solitairePlayRecordDisplay } from "@/games/solitaire/ui/play-record-display";

// 基準時間6分を54秒超え、取り消した手3手。速さ34点・安定性54点。
const record = createSolitairePlayRecord({
  difficulty: "2",
  problemIdentity: decodeSolitairePoolEntry(listSolitairePoolEntries("2")[0]!),
  startedAt: 1_000,
  completedAt: 415_000,
  result: {
    elapsedMs: 414_000,
    moveCount: 150,
    undoCount: 5,
    restartCount: 1,
    retractedMoveCount: 3,
  },
});

function getFormattedMetric(metricId: string): string | null {
  const metricDisplay = solitairePlayRecordDisplay.metrics.find(
    (metric) => metric.id === metricId,
  );
  const value = getPlayRecordMetricValue(
    record,
    solitairePlayRecordDisplay.definition,
    metricId,
  );
  return metricDisplay && value !== null
    ? metricDisplay.formatValue(value)
    : null;
}

describe("solitairePlayRecordDisplay", () => {
  test("履歴と推移に共通の比較指標を表示できること", () => {
    const score = getFormattedMetric("play-score");
    const timeDelta = getFormattedMetric("time-delta-ms");

    expect(score).toBe("88点");
    expect(timeDelta).toBe("+00:54");
  });

  const comparisonLabelCases = [
    ["1", "レベル 1"],
    ["5", "レベル 5"],
    ["normal", null],
  ] as const;

  test.each(comparisonLabelCases)(
    "比較条件 %s を利用者向けラベル %s へ変換すること",
    (key, expected) => {
      const label = solitairePlayRecordDisplay.getComparisonLabel(key);

      expect(label).toBe(expected);
    },
  );
});
