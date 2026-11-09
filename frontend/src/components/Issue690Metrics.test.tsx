import { cleanup, render, screen } from "@testing-library/react";
import type { GameResultMetric } from "@/components/GameResultScreen/ResultMetric";
import { Issue690Metrics } from "@/components/Issue690Metrics";

afterEach(cleanup);

describe("Issue690Metrics の静かな表示", () => {
  const timeMetric: GameResultMetric = {
    label: "時間",
    value: "06:25",
    detail: "基準 -08:35",
    comparison: {
      basis: "referenceTime",
      difference: -515000,
      display: "-08:35",
    },
  };
  const moveMetric: GameResultMetric = {
    label: "手数",
    value: "16手",
    detail: "最短 +2",
    comparison: { basis: "minimumMoves", difference: 2, display: "+2" },
  };
  const exactMetric: GameResultMetric = {
    label: "手数",
    value: "14手",
    detail: "最短 ±0",
    comparison: { basis: "minimumMoves", difference: 0, display: "±0" },
  };

  test.each([
    [timeMetric, "基準時間より短い -08:35", "-08:35"],
    [moveMetric, "最短手数より多い +2", "+2"],
    [exactMetric, "最短手数と同じ ±0", "±0"],
  ])(
    "比較の意味を文字として失わずに数値とアイコンで表すこと: %s",
    (metric, description, display) => {
      render(<Issue690Metrics metrics={[metric]} variant="quiet" />);

      const comparison = screen.getByLabelText(description);

      expect(comparison.textContent).toBe(display);
      expect(comparison.querySelector("svg")).toBeTruthy();
      expect(screen.queryByText(/基準時間より|最短手数より/)).toBeNull();
    },
  );

  test("従来案は基準差を文字で表す契約を維持すること", () => {
    render(<Issue690Metrics metrics={[timeMetric]} />);

    expect(screen.getByText("基準 -08:35")).toBeTruthy();
  });
});
