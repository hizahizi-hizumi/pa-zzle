import type { PlayRecord } from "@/records/play-record";

const PLAY_RECORD_COPY_FORMAT_VERSION = 1;

/**
 * 履歴一件を、問題の再現や調査に使うJSONとして書き出す。
 * ゲーム固有の問題識別情報やプレイ事実は保存済みの payload をそのまま含める。
 */
export function serializePlayRecordForCopy(record: PlayRecord): string {
  return JSON.stringify(
    {
      formatVersion: PLAY_RECORD_COPY_FORMAT_VERSION,
      gameId: record.gameId,
      recordId: record.id,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      payloadVersion: record.payloadVersion,
      payload: record.payload,
    },
    null,
    2,
  );
}
