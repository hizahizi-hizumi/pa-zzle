import { nonogramPlayRecordDisplay } from "@/games/nonogram/ui/play-record-display";

describe("nonogramPlayRecordDisplay", () => {
  const personalBestMetricIds =
    nonogramPlayRecordDisplay.definition.personalBestMetrics.map(
      ({ id }) => id,
    );

  test("自己ベストで比べる指標をすべて表示できること", () => {
    const metricIds = nonogramPlayRecordDisplay.metrics.map(({ id }) => id);

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
      const label = nonogramPlayRecordDisplay.getComparisonLabel(comparisonKey);

      expect(label).toBe(expected);
    },
  );
});
