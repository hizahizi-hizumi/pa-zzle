import type { PlayRecord } from "@/records/play-record";

const PLAY_RECORDS_COPY_FORMAT_VERSION = 1;

/**
 * 記録画面の一覧に出ている記録を、問題の再現や分析に使うJSONとしてまとめて書き出す。
 * ゲーム固有の問題識別情報やプレイ事実は保存済みの payload をそのまま含める。
 */
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
