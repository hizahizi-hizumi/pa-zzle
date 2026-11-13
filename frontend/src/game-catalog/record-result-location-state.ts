import { isRecordObject } from "@/lib/type-guards";
import {
  isPlayRecordSaveOutcome,
  type PlayRecordSaveOutcome,
} from "@/records/save-play-record";

export type RecordResultLocationState = {
  /** 自己ベスト更新などを結果画面で告知するのに使う。 */
  recordSaveOutcome: PlayRecordSaveOutcome;
};

export function createRecordResultLocationState(
  recordSaveOutcome: PlayRecordSaveOutcome,
): RecordResultLocationState {
  return { recordSaveOutcome };
}

export function readRecordSaveOutcome(
  state: unknown,
): PlayRecordSaveOutcome | undefined {
  return isRecordObject(state) &&
    isPlayRecordSaveOutcome(state.recordSaveOutcome)
    ? state.recordSaveOutcome
    : undefined;
}
