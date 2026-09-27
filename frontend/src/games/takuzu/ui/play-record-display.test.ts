import { takuzuPlayRecordDisplay } from "@/games/takuzu/ui/play-record-display";

describe("takuzuPlayRecordDisplay", () => {
  const personalBestMetricIds =
    takuzuPlayRecordDisplay.definition.personalBestMetrics.map(({ id }) => id);

  test("自己ベストで比べる指標をすべて表示できること", () => {
    const metricIds = takuzuPlayRecordDisplay.metrics.map(({ id }) => id);

    expect(metricIds).toEqual(personalBestMetricIds);
  });

  const comparisonLabelCases = [
    ["1", "レベル 1"],
    ["5", "レベル 5"],
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
