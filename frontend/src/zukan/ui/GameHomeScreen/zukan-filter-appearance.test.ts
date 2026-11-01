import type { ProblemFeatureAxisDisplay } from "@/components/problem-features";
import { formatZukanFeatureOption } from "@/zukan/ui/GameHomeScreen/zukan-filter-appearance";
import type { ZukanFeatureOption } from "@/zukan/zukan-filter";

describe("formatZukanFeatureOption", () => {
  const countDisplay: ProblemFeatureAxisDisplay = {
    label: "地雷",
    valueFormat: { kind: "count", unit: "個" },
  };
  const boardDisplay: ProblemFeatureAxisDisplay = {
    label: "盤面",
    valueFormat: { kind: "board-size" },
  };
  const squareBoardDisplay: ProblemFeatureAxisDisplay = {
    label: "盤面",
    valueFormat: { kind: "square-board-size" },
  };
  const cases: [
    string,
    ZukanFeatureOption,
    ProblemFeatureAxisDisplay,
    string,
  ][] = [
    ["1つの数", { kind: "count", min: 8, max: 8 }, countDisplay, "8個"],
    [
      "まとめた数",
      { kind: "count", min: 20, max: 24 },
      countDisplay,
      "20〜24個",
    ],
    ["0", { kind: "count", min: 0, max: 0 }, countDisplay, "なし"],
    [
      "盤面",
      { kind: "board-size", rows: 10, columns: 9 },
      boardDisplay,
      "10行×9列",
    ],
    [
      "正方形の盤面",
      { kind: "board-size", rows: 5, columns: 5 },
      squareBoardDisplay,
      "5×5",
    ],
  ];

  test.each(cases)(
    "選択肢を軸の値の書き方で示すこと: %s",
    (_, option, display, expected) => {
      const label = formatZukanFeatureOption(option, display);

      expect(label).toBe(expected);
    },
  );
});
