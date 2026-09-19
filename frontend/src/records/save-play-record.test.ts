import { expect, test } from "vitest";

import type { PlayRecord } from "./play-record";
import type { PlayRecordDefinition } from "./play-record-definition";
import { getPlayRecordSaveOutcome } from "./save-play-record";

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
  gameLabel: "テスト",
  isRecord(record) {
    return record.gameId === "test-game";
  },
  getComparisonGroup(record) {
    return record.gameId === "test-game"
      ? { key: "normal", label: "ふつう" }
      : null;
  },
  getSummary(record) {
    const value = (record.payload as { value: number }).value;
    return {
      primaryMetric: { label: "値", value: String(value) },
      detailMetrics: [],
    };
  },
  personalBestMetrics: [
    {
      id: "value",
      label: "最高値",
      direction: "higher",
      getValue(record) {
        return record.gameId === "test-game"
          ? (record.payload as { value: number }).value
          : null;
      },
      formatValue(value) {
        return String(value);
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
        label: "最高値",
        previousValue: "80",
        currentValue: "95",
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
