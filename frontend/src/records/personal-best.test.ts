import { expect, test } from "vitest";
import { getPersonalBests } from "./personal-best";
import type { PlayRecord } from "./play-record";
import type { PlayRecordDefinition } from "./play-record-definition";

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

test("比較対象の履歴から自己ベストを導出できること", () => {
  const records = [createRecord("record-1", 80), createRecord("record-2", 95)];

  const personalBests = getPersonalBests(records, definition);

  expect(personalBests).toEqual([
    {
      metricId: "value",
      label: "最高値",
      value: "95",
      rawValue: 95,
    },
  ]);
});
