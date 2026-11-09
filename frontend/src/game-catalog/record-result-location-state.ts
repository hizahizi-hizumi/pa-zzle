import {
  type Issue690BoardSnapshot,
  isIssue690BoardSnapshot,
} from "@/games/issue690-board-snapshot";
import { isRecordObject } from "@/lib/type-guards";
import {
  isPlayRecordSaveOutcome,
  type PlayRecordSaveOutcome,
} from "@/records/save-play-record";

/** クリアしたプレイから結果画面へ遷移するときに渡す location state。 */
export type RecordResultLocationState = {
  /** 記録を保存した結果。自己ベスト更新などを結果画面で告知するのに使う。 */
  recordSaveOutcome: PlayRecordSaveOutcome;
  issue690BoardSnapshot?: Issue690BoardSnapshot;
};

export function createRecordResultLocationState(
  recordSaveOutcome: PlayRecordSaveOutcome,
  issue690BoardSnapshot?: Issue690BoardSnapshot,
): RecordResultLocationState {
  return { recordSaveOutcome, issue690BoardSnapshot };
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

export function readIssue690BoardSnapshot(
  state: unknown,
): Issue690BoardSnapshot | undefined {
  if (!isRecordObject(state)) return undefined;
  return isIssue690BoardSnapshot(state.issue690BoardSnapshot)
    ? state.issue690BoardSnapshot
    : undefined;
}
