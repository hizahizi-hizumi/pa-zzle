import type { PlayRecord } from "@/records/play-record";
import { serializePlayRecordsForCopy } from "@/records/play-record-copy";

function createRecord(id: string, completedAt: number): PlayRecord {
  return {
    id,
    gameId: "test",
    startedAt: completedAt - 1_000,
    completedAt,
    payloadVersion: 2,
    payload: {
      difficulty: "5",
      problemIdentity: { seed: id, conditions: { size: 4 } },
      performance: { elapsedMs: 1_000 },
    },
  };
}

describe("serializePlayRecordsForCopy", () => {
  test("一覧の記録を並び順のまま識別情報と保存済みpayloadで書き出すこと", () => {
    const records = [
      createRecord("record-2", 3_000),
      createRecord("record-1", 2_000),
    ];

    expect(JSON.parse(serializePlayRecordsForCopy(records))).toEqual({
      formatVersion: 1,
      records: records.map((record) => ({
        gameId: record.gameId,
        recordId: record.id,
        startedAt: record.startedAt,
        completedAt: record.completedAt,
        payloadVersion: record.payloadVersion,
        payload: record.payload,
      })),
    });
  });
});
