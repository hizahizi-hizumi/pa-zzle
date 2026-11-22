import { getPlayRecordMetricDisplay } from "@/features/records/ui/play-record-display";
import { magicSquarePlayRecordDisplay } from "@/games/magic-square/ui/play-record-display";

describe("magicSquarePlayRecordDisplay", () => {
  const personalBestMetricIds =
    magicSquarePlayRecordDisplay.definition.personalBestMetrics.map(
      ({ id }) => id,
    );

  test("自己ベストで比べる指標をすべて表示できること", () => {
    const metricIds = magicSquarePlayRecordDisplay.metrics.map(({ id }) => id);

    expect(metricIds).toEqual(personalBestMetricIds);
  });

  test("取り下げの回数を回で書くこと", () => {
    const text = getPlayRecordMetricDisplay(
      magicSquarePlayRecordDisplay,
      "withdrawal-count",
    )?.formatValue(2);

    expect(text).toBe("2回");
  });

  const comparisonLabelCases = [
    ["1", "レベル 1"],
    ["5", "レベル 5"],
    ["easy", null],
  ] as const;

  test.each(comparisonLabelCases)(
    "比較条件 %s を利用者向けラベル %s へ変換すること",
    (comparisonKey, expected) => {
      const label =
        magicSquarePlayRecordDisplay.getComparisonLabel(comparisonKey);

      expect(label).toBe(expected);
    },
  );
});
