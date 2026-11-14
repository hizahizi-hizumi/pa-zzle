import type { PlayRecord } from "@/features/records/play-record";

const PLAY_RECORDS_COPY_FORMAT_VERSION = 1;

export function serializePlayRecordsForCopy(
  records: readonly PlayRecord[],
): string {
  return JSON.stringify(
    {
      formatVersion: PLAY_RECORDS_COPY_FORMAT_VERSION,
      records: records.map((record) => ({
        gameId: record.gameId,
        recordId: record.id,
        startedAt: record.startedAt,
        completedAt: record.completedAt,
        payloadVersion: record.payloadVersion,
        payload: record.payload,
      })),
    },
    null,
    2,
  );
}
