import { expect, test } from "vitest";

import type { PlayRecord } from "./play-record";
import {
  getPersonalBests,
  getPlayRecordSaveOutcome,
  type PlayRecordAdapter,
} from "./presentation";

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

const adapter: PlayRecordAdapter = {
  gameId: "test-game",
  gameLabel: "テスト",
  isRecord(record) {
    return record.gameId === "test-game";
  },
  getComparisonKey(record) {
    return record.gameId === "test-game" ? "normal" : null;
  },
  getComparisonLabel(record) {
    return record.gameId === "test-game" ? "ふつう" : null;
  },
  getHistoryPresentation(record) {
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

test("比較対象の履歴から自己ベストを導出できること", () => {
  const records = [createRecord("record-1", 80), createRecord("record-2", 95)];

  const personalBests = getPersonalBests(records, adapter);

  expect(personalBests).toEqual([
    {
      metricId: "value",
      label: "最高値",
      value: "95",
      rawValue: 95,
    },
  ]);
});

test("最初のプレイを初記録として扱うこと", () => {
  const record = createRecord("record-1", 80);

  const outcome = getPlayRecordSaveOutcome([], record, adapter);

  expect(outcome).toEqual({ status: "first-record" });
});

test("既存ベストを上回った指標だけを更新として返すこと", () => {
  const previous = [createRecord("record-1", 80)];
  const current = createRecord("record-2", 95);

  const outcome = getPlayRecordSaveOutcome(previous, current, adapter);

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

  const outcome = getPlayRecordSaveOutcome(previous, current, adapter);

  expect(outcome).toEqual({ status: "recorded" });
});
