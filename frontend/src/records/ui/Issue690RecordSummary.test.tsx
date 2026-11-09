import { cleanup, render, screen } from "@testing-library/react";
import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";
import type { PlayRecordSaveOutcome } from "@/records/save-play-record";
import { Issue690RecordSummary } from "@/records/ui/Issue690RecordSummary";

const display = nanpurePlayRecordDisplay;

const outcomesWithoutNews: (PlayRecordSaveOutcome | null | undefined)[] = [
  null,
  undefined,
  { status: "recorded" },
];

const bestUpdate: PlayRecordSaveOutcome = {
  status: "updated",
  updates: [
    { metricId: "play-score", previousValue: 95, currentValue: 100 },
    {
      metricId: "time-delta-ms",
      previousValue: -120_000,
      currentValue: -137_000,
    },
    { metricId: "mistake-count", previousValue: 2, currentValue: 1 },
  ],
};

afterEach(cleanup);

describe("Issue690RecordSummary", () => {
  test.each(outcomesWithoutNews)(
    "通知する変化がない記録には説明を追加しないこと",
    (outcome) => {
      const { container } = render(
        <Issue690RecordSummary outcome={outcome} display={display} />,
      );

      expect(container.textContent).toBe("");
    },
  );

  test("表示定義がなくても自己ベスト更新を保存失敗として示さないこと", () => {
    const { container } = render(
      <Issue690RecordSummary outcome={bestUpdate} display={undefined} />,
    );

    expect(container.textContent).toBe("");
  });

  test("初めての記録を確実に知らせること", () => {
    render(
      <Issue690RecordSummary
        outcome={{ status: "first-record" }}
        display={display}
      />,
    );

    expect(screen.getByText("はじめての記録")).toBeTruthy();
  });

  test("保存できなかったことを明確に知らせること", () => {
    render(
      <Issue690RecordSummary
        outcome={{ status: "failed" }}
        display={display}
      />,
    );

    expect(screen.getByText("記録を保存できませんでした")).toBeTruthy();
    expect(screen.getByText("今回の結果は保存されていません")).toBeTruthy();
  });

  test("複数の自己ベスト更新を省かず伝えること", () => {
    render(<Issue690RecordSummary outcome={bestUpdate} display={display} />);

    const update = screen.getByRole("region", { name: "自己ベスト更新" });
    expect(update.textContent).toContain("+5点");
    expect(update.textContent).toContain("17秒短縮");
    expect(update.textContent).toContain("1回減");
  });
});
