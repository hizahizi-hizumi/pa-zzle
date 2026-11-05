import { bridgesPlayRecordDisplay } from "@/games/bridges/ui/play-record-display";

describe("bridgesPlayRecordDisplay", () => {
  const personalBestMetricIds =
    bridgesPlayRecordDisplay.definition.personalBestMetrics.map(({ id }) => id);

  test("自己ベストで比べる指標をすべて表示できること", () => {
    const metricIds = bridgesPlayRecordDisplay.metrics.map(({ id }) => id);

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
      const label = bridgesPlayRecordDisplay.getComparisonLabel(comparisonKey);

      expect(label).toBe(expected);
    },
  );
});
