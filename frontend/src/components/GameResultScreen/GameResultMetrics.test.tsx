import { cleanup, render, screen } from "@testing-library/react";
import { GameResultMetrics } from "@/components/GameResultScreen/GameResultMetrics";
import type { GameResultMetric } from "@/components/GameResultScreen/ResultMetric";
import {
  createElapsedTimeMetric,
  createMoveCountMetric,
} from "@/components/game-result-metrics";
import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";
import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";
import { createResultRecordFeedback } from "@/records/ui/result-record-feedback";

afterEach(cleanup);

describe("GameResultMetrics の静かな表示", () => {
  let container: HTMLElement;

  beforeEach(() => {
    ({ container } = render(
      <GameResultMetrics
        improvements={[]}
        metrics={[
          {
            label: "時間",
            value: "06:25",
            comparison: {
              basis: "referenceTime",
              difference: -515000,
              display: "-08:35",
            },
          },
          { label: "ミス", value: "1回" },
          { label: "待った", value: "2回" },
        ]}
      />,
    ));
  });

  test("成績の種類を個別のアイコンに依存せず文字で示すこと", () => {
    const labels = ["時間", "ミス", "待った"].map((label) =>
      screen.getByText(label),
    );

    expect(labels).toHaveLength(3);
    expect(container.querySelectorAll("dt svg")).toHaveLength(0);
    expect(
      container.querySelectorAll(".result-metric-comparison svg"),
    ).toHaveLength(1);
  });
});

const comparisonCases: {
  metric: GameResultMetric;
  description: string;
  display: string;
}[] = [
  {
    metric: {
      label: "時間",
      value: "06:25",
      comparison: {
        basis: "referenceTime",
        difference: -515000,
        display: "-08:35",
      },
    },
    description: "基準時間より短い -08:35",
    display: "基準差 -08:35",
  },
  {
    metric: {
      label: "手数",
      value: "16手",
      comparison: { basis: "minimumMoves", difference: 2, display: "+2" },
    },
    description: "最短手数より多い +2",
    display: "最短差 +2",
  },
  {
    metric: {
      label: "手数",
      value: "14手",
      comparison: { basis: "minimumMoves", difference: 0, display: "±0" },
    },
    description: "最短手数と同じ ±0",
    display: "最短差 ±0",
  },
];

describe.each(comparisonCases)(
  "比較指標の表示: $description",
  ({ metric, description, display }) => {
    beforeEach(() => {
      render(<GameResultMetrics metrics={[metric]} improvements={[]} />);
    });

    test("比較の意味を文字として失わずに数値とアイコンで表すこと", () => {
      const comparison = screen.getByLabelText(description);

      expect(comparison.textContent).toBe(display);
      expect(comparison.querySelector("svg")).toBeTruthy();
    });
  },
);

describe("異なる問題の基準で自己ベストを更新した場合", () => {
  const updatedTime = createResultRecordFeedback(
    {
      status: "updated",
      updates: [
        {
          metricId: "time-delta-ms",
          previousValue: 15_000,
          currentValue: 10_000,
        },
      ],
    },
    nanpurePlayRecordDisplay,
  );
  const updatedMoves = createResultRecordFeedback(
    {
      status: "updated",
      updates: [{ metricId: "move-delta", previousValue: 4, currentValue: 2 }],
    },
    waterSortPlayRecordDisplay,
  );
  const displayCases = [
    {
      metric: createElapsedTimeMetric({
        elapsedMs: 70_000,
        timeDeltaMs: 10_000,
      }),
      feedback: updatedTime,
      actual: "01:10",
      comparison: "基準差 +00:10",
      improvement: "基準差 5秒短縮",
    },
    {
      metric: createMoveCountMetric({ moveCount: 30, moveDelta: 2 }),
      feedback: updatedMoves,
      actual: "30手",
      comparison: "最短差 +2",
      improvement: "最短差 2手減",
    },
  ];

  describe.each(displayCases)(
    "基準差の自己ベスト更新: $actual",
    ({ metric, feedback, actual, comparison, improvement }) => {
      let container: HTMLElement;

      beforeEach(() => {
        const improvements =
          feedback.kind === "updated" ? feedback.improvements : [];
        ({ container } = render(
          <GameResultMetrics metrics={[metric]} improvements={improvements} />,
        ));
      });

      test("実測値が増えても基準との差の更新を別の尺度として示すこと", () => {
        const recordedImprovement = container.querySelector(
          ".result-metric-best",
        );

        expect(screen.getByText(actual)).toBeTruthy();
        expect(screen.getByText(comparison)).toBeTruthy();
        expect(screen.getByText(improvement)).toBeTruthy();
        expect(recordedImprovement?.textContent).toBe(improvement);
      });
    },
  );
});

describe("記録と結果指標のID対応", () => {
  const improvement = [
    {
      id: "mistake-count",
      label: "ミス",
      previous: "3回",
      current: "2回",
      improvement: "1回減",
    },
  ];
  const cases = [
    { metrics: [{ label: "ミス", value: "2回" }], matched: false },
    {
      metrics: [
        { label: "ミス", value: "2回", recordMetricId: "mistake-count" },
      ],
      matched: true,
    },
  ];

  describe.each(cases)("指標IDの指定: $matched", ({ metrics, matched }) => {
    let container: HTMLElement;

    beforeEach(() => {
      ({ container } = render(
        <GameResultMetrics metrics={metrics} improvements={improvement} />,
      ));
    });

    test("ラベルが同じでも指標IDが対応するときだけ更新を表示すること", () => {
      const displayed = Boolean(container.querySelector(".result-metric-best"));

      expect(displayed).toBe(matched);
    });
  });
});
