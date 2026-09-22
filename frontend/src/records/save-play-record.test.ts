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

describe("getPlayRecordSaveOutcome", () => {
  const firstRecord = createRecord("record-1", 80);
  const previousBest = createRecord("record-1", 80);
  const improvedRecord = createRecord("record-2", 95);
  const tiedPreviousBest = createRecord("record-1", 95);
  const tiedRecord = createRecord("record-2", 95);

  test("最初のプレイを初記録として扱うこと", () => {
    const outcome = getPlayRecordSaveOutcome([], firstRecord, definition);

    expect(outcome).toEqual({ status: "first-record" });
  });

  test("既存ベストを上回った指標だけを更新として返すこと", () => {
    const outcome = getPlayRecordSaveOutcome(
      [previousBest],
      improvedRecord,
      definition,
    );

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
    const outcome = getPlayRecordSaveOutcome(
      [tiedPreviousBest],
      tiedRecord,
      definition,
    );

    expect(outcome).toEqual({ status: "recorded" });
  });
});
