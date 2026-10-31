/**
 * 保存データ・診断情報など外部から読み戻した `unknown` の値の形を確かめる型ガード。
 * 記録・試行・問題の identity・診断の検査は、ここにある型ガードで書く。
 */

/** 配列でも `null` でもないオブジェクトか。プロパティを読む前の絞り込みに使う。 */
export function isRecordObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** 経過時間のような、0以上の有限の数か。 */
export function isNonNegativeFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

/** 回数のような、0以上の整数か。 */
export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** 大きさ・試行番号のような、1以上の整数か。 */
export function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}
