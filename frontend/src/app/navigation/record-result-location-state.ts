import { isPlayRecord, type PlayRecord } from "@/features/records/play-record";
import {
  isPlayRecordSaveOutcome,
  type PlayRecordSaveOutcome,
} from "@/features/records/save-play-record";
import { isRecordObject } from "@/lib/type-guards";

export type RecordResultLocationState = {
  /** 自己ベスト更新などを結果画面で告知するのに使う。 */
  recordSaveOutcome: PlayRecordSaveOutcome;
  /** 保存失敗時に、このブラウザ履歴から結果を表示するための記録。 */
  unsavedRecord?: PlayRecord;
};

export function createRecordResultLocationState(
  recordSaveOutcome: PlayRecordSaveOutcome,
  record?: PlayRecord,
): RecordResultLocationState {
  return recordSaveOutcome.status === "failed" && record
    ? { recordSaveOutcome, unsavedRecord: record }
    : { recordSaveOutcome };
}

export function readRecordSaveOutcome(
  state: unknown,
): PlayRecordSaveOutcome | undefined {
  return isRecordObject(state) &&
    isPlayRecordSaveOutcome(state.recordSaveOutcome)
    ? state.recordSaveOutcome
    : undefined;
}

/** 端末に保存されなかった結果を、同じ履歴エントリに限って表示する。 */
export function readUnsavedRecord(
  state: unknown,
  gameId: string,
  recordId: string,
): PlayRecord | null {
  if (!isRecordObject(state)) return null;
  if (
    !isPlayRecordSaveOutcome(state.recordSaveOutcome) ||
    state.recordSaveOutcome.status !== "failed" ||
    !isPlayRecord(state.unsavedRecord)
  )
    return null;
  const record = state.unsavedRecord;
  return record.gameId === gameId && record.id === recordId ? record : null;
}
