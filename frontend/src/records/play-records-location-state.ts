import {
  isNonNegativeFiniteNumber,
  isPositiveInteger,
  isRecordObject,
} from "@/lib/type-guards";

/** 記録画面から1件を開くときに、記録画面の履歴へ残す location state。戻ったときに一覧を同じ所まで描き、同じ位置へ戻すのに使う。 */
export type PlayRecordsLocationState = {
  /** 一覧に描いていたプレイの数。 */
  shownEntryCount: number;
  /** ページの縦のスクロール位置。 */
  scrollY: number;
};

export function createPlayRecordsLocationState(
  shownEntryCount: number,
  scrollY: number,
): PlayRecordsLocationState {
  return { shownEntryCount, scrollY };
}

/** location state から記録画面の一覧の位置を読む。記録画面向けの state でなければ `null` を返す。 */
export function readPlayRecordsLocationState(
  state: unknown,
): PlayRecordsLocationState | null {
  return isRecordObject(state) &&
    isPositiveInteger(state.shownEntryCount) &&
    isNonNegativeFiniteNumber(state.scrollY)
    ? { shownEntryCount: state.shownEntryCount, scrollY: state.scrollY }
    : null;
}
