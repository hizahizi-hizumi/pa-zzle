import { hitofudePuzzlePlayRecordDisplay } from "@/games/hitofude-puzzle/ui/play-record-display";

describe("hitofudePuzzlePlayRecordDisplay", () => {
  const personalBestMetricIds =
    hitofudePuzzlePlayRecordDisplay.definition.personalBestMetrics.map(
      ({ id }) => id,
    );

  test("自己ベストで比べる指標をすべて表示できること", () => {
    const metricIds = hitofudePuzzlePlayRecordDisplay.metrics.map(
      ({ id }) => id,
    );

    expect(metricIds).toEqual(personalBestMetricIds);
  });

  describe("引き直しの指標", () => {
    const backtrack = hitofudePuzzlePlayRecordDisplay.metrics.find(
      ({ id }) => id === "backtrack-count",
    );

    test("引き直しの回数を単位付きで表示すること", () => {
      const value = backtrack?.formatValue(3);

      expect(backtrack?.label).toBe("引き直し");
      expect(value).toBe("3回");
    });

    test("自己ベストの更新幅を、回数の指標に共通の書き方で表示すること", () => {
      const improvement = backtrack?.formatImprovement(3);

      expect(improvement).toBe("3回減");
    });
  });

  test("離脱の進み具合を時間・通ったマス・引き直しの順に単位付きで表示すること", () => {
    const progress = Object.values(
      hitofudePuzzlePlayRecordDisplay.progress,
    ).map(({ label, formatValue }) => `${label} ${formatValue(12)}`);

    expect(progress).toEqual([
      "時間 00:00",
      "通ったマス 12マス",
      "引き直し 12回",
    ]);
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
        hitofudePuzzlePlayRecordDisplay.getComparisonLabel(comparisonKey);

      expect(label).toBe(expected);
    },
  );
});
