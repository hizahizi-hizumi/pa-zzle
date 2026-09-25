import { getPersonalBests } from "@/records/personal-best";
import type { PlayRecord } from "@/records/play-record";
import type { PlayRecordDefinition } from "@/records/play-record-definition";

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

test("比較対象の履歴から自己ベストを導出できること", () => {
  const records = [createRecord("record-1", 80), createRecord("record-2", 95)];

  const personalBests = getPersonalBests(records, definition);

  expect(personalBests).toEqual([
    {
      metricId: "value",
      value: 95,
    },
  ]);
});
