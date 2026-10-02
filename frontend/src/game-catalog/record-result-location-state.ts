import {
  isPlayRecordSaveOutcome,
  type PlayRecordSaveOutcome,
} from "@/records/save-play-record";

/** クリアしたプレイから結果画面へ遷移するときに渡す location state。 */
export type RecordResultLocationState = {
  /** 記録を保存した結果。自己ベスト更新などを結果画面で告知するのに使う。 */
  recordSaveOutcome: PlayRecordSaveOutcome;
};

export function createRecordResultLocationState(
  recordSaveOutcome: PlayRecordSaveOutcome,
): RecordResultLocationState {
  return { recordSaveOutcome };
}

/** location state から記録の保存結果を読む。結果画面向けの state でなければ `null` を返す。 */
export function readRecordSaveOutcome(
  state: unknown,
): PlayRecordSaveOutcome | null {
  return typeof state === "object" &&
    state !== null &&
    "recordSaveOutcome" in state &&
    isPlayRecordSaveOutcome(state.recordSaveOutcome)
    ? state.recordSaveOutcome
    : null;
}
