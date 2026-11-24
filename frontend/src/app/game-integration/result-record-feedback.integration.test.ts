import { createResultRecordFeedback } from "@/features/records/ui/result-record-feedback";
import { createNanpurePlayRecord } from "@/games/nanpure/play-record";
import { createNanpureProblemIdentity } from "@/games/nanpure/problem/problem";
import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";

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

describe("過去の自己ベストとの比較", () => {
  const bestRecord = createNanpurePlayRecord({
    difficulty: "3",
    problemIdentity: createNanpureProblemIdentity("x-wing", 1),
    startedAt: 100,
    completedAt: 60_100,
    result: {
      elapsedMs: 60_000,
      mistakeCount: 0,
      undoCount: 0,
      restartCount: 0,
    },
  });
  const slowerRecord = createNanpurePlayRecord({
    difficulty: "3",
    problemIdentity: createNanpureProblemIdentity("x-wing", 2),
    startedAt: 200_000,
    completedAt: 320_000,
    result: {
      elapsedMs: 120_000,
      mistakeCount: 2,
      undoCount: 0,
      restartCount: 0,
    },
  });
  const otherDifficultyRecord = {
    ...bestRecord,
    id: "other-difficulty",
    payload: { ...bestRecord.payload, difficulty: "2" as const },
  };
  const comparison = {
    currentRecord: slowerRecord,
    previousRecords: [otherDifficultyRecord, bestRecord],
  };

  test("更新しなかった指標について高いほど良い点数と低いほど良い値の差を示すこと", () => {
    const feedback = createResultRecordFeedback(
      { status: "recorded" },
      display,
      comparison,
    );

    expect(feedback).toMatchObject({
      kind: "none",
      comparisons: [
        { id: "play-score", delta: "−10点" },
        { id: "time-delta-ms", delta: "+1分" },
        { id: "mistake-count", delta: "+2回" },
      ],
    });
  });

  test("時間の差を、秒未満を切り捨てた秒で示すこと", () => {
    const slightlySlowerRecord = {
      ...bestRecord,
      id: "slightly-slower-record",
      payload: {
        ...bestRecord.payload,
        performance: { ...bestRecord.payload.performance, elapsedMs: 64_341 },
      },
    };

    const feedback = createResultRecordFeedback(
      { status: "recorded" },
      display,
      { currentRecord: slightlySlowerRecord, previousRecords: [bestRecord] },
    );

    expect(feedback).toMatchObject({
      comparisons: [
        { id: "play-score" },
        { id: "time-delta-ms", delta: "+4秒" },
        { id: "mistake-count" },
      ],
    });
  });

  test("同値の指標を更新扱いせずに自己ベストと同じと示すこと", () => {
    const tiedRecord = {
      ...bestRecord,
      id: "tied-record",
    };

    const feedback = createResultRecordFeedback(
      { status: "recorded" },
      display,
      { currentRecord: tiedRecord, previousRecords: [bestRecord] },
    );

    expect(feedback).toMatchObject({
      kind: "none",
      comparisons: [
        { id: "play-score", delta: "±0点" },
        { id: "time-delta-ms", delta: "±0秒" },
        { id: "mistake-count", delta: "±0回" },
      ],
    });
  });

  test("更新した指標の情報と更新しなかった指標の比較情報を両立すること", () => {
    const feedback = createResultRecordFeedback(
      {
        status: "updated",
        updates: [
          { metricId: "play-score", previousValue: 60, currentValue: 70 },
        ],
      },
      display,
      comparison,
    );

    expect(feedback).toMatchObject({
      kind: "updated",
      improvements: [{ id: "play-score", improvement: "+10点" }],
      comparisons: [
        { id: "play-score" },
        { id: "time-delta-ms" },
        { id: "mistake-count" },
      ],
    });
  });

  test("比較可能な過去の記録がなければ差を作らないこと", () => {
    const feedback = createResultRecordFeedback(
      { status: "recorded" },
      display,
      { currentRecord: slowerRecord, previousRecords: [otherDifficultyRecord] },
    );

    expect(feedback).toEqual({ kind: "none" });
  });

  test("初記録や保存失敗に過去との差を添えないこと", () => {
    const outcomes = ["first-record", "failed"] as const;
    const feedbacks = outcomes.map((status) =>
      createResultRecordFeedback({ status }, display, comparison),
    );

    expect(feedbacks).toEqual([{ kind: "first-record" }, { kind: "failed" }]);
  });
});
