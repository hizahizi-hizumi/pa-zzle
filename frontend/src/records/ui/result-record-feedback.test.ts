import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";
import { createResultRecordFeedback } from "@/records/ui/result-record-feedback";

const display = nanpurePlayRecordDisplay;

describe("createResultRecordFeedback", () => {
  const noRecordCases = [null, { status: "recorded" } as const];
  const statusCases = ["first-record", "failed"] as const;
  const updatedOutcome = {
    status: "updated",
    updates: [
      { metricId: "play-score", previousValue: 95, currentValue: 100 },
      {
        metricId: "time-delta-ms",
        previousValue: -120000,
        currentValue: -137000,
      },
      { metricId: "mistake-count", previousValue: 2, currentValue: 1 },
    ],
  } as const;
  const unavailableDisplayOutcome = {
    status: "updated",
    updates: [{ metricId: "play-score", previousValue: 95, currentValue: 100 }],
  } as const;

  test.each(noRecordCases)(
    "保存状態のない記録では通知を作らないこと",
    (outcome) => {
      const feedback = createResultRecordFeedback(outcome, display);

      expect(feedback).toEqual({ kind: "none" });
    },
  );

  test.each(statusCases)("保存状態 %s を区別すること", (status) => {
    const feedback = createResultRecordFeedback({ status }, display);

    expect(feedback).toEqual({ kind: status });
  });

  test("自己ベストを点数・時間・ミスの対応する指標として返すこと", () => {
    const feedback = createResultRecordFeedback(updatedOutcome, display);

    expect(feedback.kind).toBe("updated");
    if (feedback.kind !== "updated") throw new Error("更新がありません");
    expect(
      feedback.improvements.map((item) => [item.id, item.improvement]),
    ).toEqual([
      ["play-score", "+5点"],
      ["time-delta-ms", "17秒短縮"],
      ["mistake-count", "1回減"],
    ]);
    expect(feedback.improvements[1]?.previous).toBe("-02:00");
    expect(feedback.improvements[1]?.current).toBe("-02:17");
  });

  test("表示定義が取得できない更新を保存失敗として誤表示しないこと", () => {
    const feedback = createResultRecordFeedback(
      unavailableDisplayOutcome,
      undefined,
    );

    expect(feedback).toEqual({ kind: "none" });
  });
});
