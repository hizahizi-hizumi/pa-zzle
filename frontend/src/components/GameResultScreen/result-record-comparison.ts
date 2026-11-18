import type { ResultRecordComparison } from "@/games/play";

export function describeResultRecordComparison(
  comparison: ResultRecordComparison,
): string {
  return `${comparison.label}の自己ベストとの差：${comparison.previous}から${comparison.current}、${comparison.delta}`;
}
