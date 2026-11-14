import {
  isNonNegativeFiniteNumber,
  isPositiveInteger,
  isRecordObject,
} from "@/lib/type-guards";

/** 戻ったときに一覧を同じ所まで描き、同じ位置へ戻すのに使う。 */
export type PlayRecordsLocationState = {
  shownEntryCount: number;
  scrollY: number;
};

export function createPlayRecordsLocationState(
  shownEntryCount: number,
  scrollY: number,
): PlayRecordsLocationState {
  return { shownEntryCount, scrollY };
}

export function readPlayRecordsLocationState(
  state: unknown,
): PlayRecordsLocationState | null {
  return isRecordObject(state) &&
    isPositiveInteger(state.shownEntryCount) &&
    isNonNegativeFiniteNumber(state.scrollY)
    ? { shownEntryCount: state.shownEntryCount, scrollY: state.scrollY }
    : null;
}
