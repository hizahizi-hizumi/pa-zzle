import type { PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";
import {
  getPlayRecordSaveOutcome,
  isPlayRecordSaveOutcome,
} from "@/records/save-play-record";

function createRecord(id: string, value: number): PlayRecord {
  return {
    id,
    gameId: "test-game",
    startedAt: 1_000,
    completedAt: 2_000 + value,
    payloadVersion: 1,
    payload: { value, condition: "normal" },
  };
}

const definition: PlayRecordDefinition = {
  gameId: "test-game",
  isRecord(record) {
    return record.gameId === "test-game";
  },
  getComparisonKey(record) {
    return record.gameId === "test-game" ? "normal" : null;
  },
  personalBestMetrics: [
    {
      id: "value",
      direction: "higher",
      getValue(record) {
        return record.gameId === "test-game"
          ? (record.payload as { value: number }).value
          : null;
      },
    },
  ],
};

test("最初のプレイを初記録として扱うこと", () => {
  const record = createRecord("record-1", 80);

  const outcome = getPlayRecordSaveOutcome([], record, definition);

  expect(outcome).toEqual({ status: "first-record" });
});

test("既存ベストを上回った指標だけを更新として返すこと", () => {
  const previous = [createRecord("record-1", 80)];
  const current = createRecord("record-2", 95);

  const outcome = getPlayRecordSaveOutcome(previous, current, definition);

  expect(outcome).toEqual({
    status: "updated",
    updates: [
      {
        metricId: "value",
        previousValue: 80,
        currentValue: 95,
      },
    ],
  });
});

test("同率の自己ベストを更新扱いにしないこと", () => {
  const previous = [createRecord("record-1", 95)];
  const current = createRecord("record-2", 95);

  const outcome = getPlayRecordSaveOutcome(previous, current, definition);

  expect(outcome).toEqual({ status: "recorded" });
});

describe("isPlayRecordSaveOutcome", () => {
  const outcomes = [
    ["初記録", { status: "first-record" }],
    ["記録のみ", { status: "recorded" }],
    ["保存失敗", { status: "failed" }],
    [
      "自己ベスト更新",
      {
        status: "updated",
        updates: [{ metricId: "value", previousValue: 80, currentValue: 90 }],
      },
    ],
  ] as const;

  test.each(outcomes)("%sの保存結果を受け入れること", (_, value) => {
    const accepted = isPlayRecordSaveOutcome(value);

    expect(accepted).toBe(true);
  });

  const otherValues = [
    ["null", null],
    ["文字列", "recorded"],
    ["未知の status", { status: "saved" }],
    ["更新内容の無い自己ベスト更新", { status: "updated" }],
    [
      "更新内容の値が数値ではない自己ベスト更新",
      {
        status: "updated",
        updates: [{ metricId: "value", previousValue: "80", currentValue: 90 }],
      },
    ],
  ] as const;

  test.each(otherValues)("%sを受け入れないこと", (_, value) => {
    const accepted = isPlayRecordSaveOutcome(value);

    expect(accepted).toBe(false);
  });
});
