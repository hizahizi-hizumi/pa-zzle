import {
  getPersonalBests,
  listComparableRecords,
} from "@/features/records/personal-best";
import type { PlayRecord } from "@/features/records/play-record";
import type { PlayRecordDefinition } from "@/features/records/play-record-definition";

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

function createConditionRecord(
  id: string,
  condition: string,
  completedAt: number,
): PlayRecord {
  return {
    ...createRecord(id, 0),
    completedAt,
    payload: { value: 0, condition },
  };
}

const definition: PlayRecordDefinition = {
  gameId: "test-game",
  isRecord(record) {
    return record.gameId === "test-game";
  },
  getComparisonKey(record) {
    return record.gameId === "test-game"
      ? (record.payload as { condition: string }).condition
      : null;
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
  getClearPerformance(record) {
    return record.gameId === "test-game"
      ? { elapsedMs: record.completedAt - record.startedAt }
      : null;
  },
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

describe("listComparableRecords", () => {
  const records = [
    createConditionRecord("older", "normal", 3_000),
    createConditionRecord("hard", "hard", 5_000),
    {
      ...createConditionRecord("other-game", "normal", 6_000),
      gameId: "other",
    },
    createConditionRecord("newer", "normal", 4_000),
  ];

  test("同じゲームの同じ開始条件の記録だけを、完了した時刻の新しい順に選ぶこと", () => {
    const comparable = listComparableRecords(records, definition, "normal");

    expect(comparable.map(({ id }) => id)).toEqual(["newer", "older"]);
  });
});
