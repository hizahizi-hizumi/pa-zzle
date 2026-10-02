import type { PlayRecord } from "@/records/play-record";
import { serializePlayRecordForCopy } from "@/records/play-record-copy";

describe("serializePlayRecordForCopy", () => {
  test("記録の識別情報と保存済みpayloadを再現用JSONとして書き出すこと", () => {
    const payload = {
      difficulty: "5",
      problemIdentity: { seed: "seed", conditions: { size: 4 } },
      performance: { elapsedMs: 120_000 },
    };
    const record: PlayRecord = {
      id: "record-1",
      gameId: "test",
      startedAt: 1_000,
      completedAt: 121_000,
      payloadVersion: 2,
      payload,
    };

    expect(JSON.parse(serializePlayRecordForCopy(record))).toEqual({
      formatVersion: 1,
      gameId: "test",
      recordId: "record-1",
      startedAt: 1_000,
      completedAt: 121_000,
      payloadVersion: 2,
      payload,
    });
  });
});
