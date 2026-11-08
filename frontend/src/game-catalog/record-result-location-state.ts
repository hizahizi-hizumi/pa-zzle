import { isRecordObject } from "@/lib/type-guards";
import {
  isPlayRecordSaveOutcome,
  type PlayRecordSaveOutcome,
} from "@/records/save-play-record";

/** クリアしたプレイから結果画面へ遷移するときに渡す location state。 */
export type RecordResultLocationState = {
  /** 記録を保存した結果。自己ベスト更新などを結果画面で告知するのに使う。 */
  recordSaveOutcome: PlayRecordSaveOutcome;
  studyCode?: string;
};

export function createRecordResultLocationState(
  recordSaveOutcome: PlayRecordSaveOutcome,
  studyCode?: string,
): RecordResultLocationState {
  return {
    recordSaveOutcome,
    ...(studyCode ? { studyCode } : {}),
  };
}

/** location state から記録の保存結果を読む。結果画面向けの state でなければ `undefined` を返す。 */
export function readRecordSaveOutcome(
  state: unknown,
): PlayRecordSaveOutcome | undefined {
  return isRecordObject(state) &&
    isPlayRecordSaveOutcome(state.recordSaveOutcome)
    ? state.recordSaveOutcome
    : undefined;
}

export function readRecordResultStudyCode(state: unknown): string | null {
  return isRecordObject(state) && typeof state.studyCode === "string"
    ? state.studyCode
    : null;
}
