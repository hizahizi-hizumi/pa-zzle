import type { NanpureUnitKind } from "@/games/nanpure/puzzle/rules";

const unitNames = {
  row: "行",
  column: "列",
  block: "ブロック",
} as const satisfies Record<NanpureUnitKind, string>;

/**
 * 数字が重なったまとまりを、判定の下に添える短い言葉にする。重なったまとまりをすべて「・」でつなぐ。
 * 例が教えるまとまりのほかに重なったとき（`also`）は「でも」、例が重なりを教えない例で重なったときは「で」でつなぐ。
 * 重なっていなければ `undefined`。
 */
export function describeNanpureConflictKinds(
  kinds: readonly NanpureUnitKind[],
  { also }: { also: boolean },
): string | undefined {
  if (kinds.length === 0) {
    return undefined;
  }
  const names = kinds.map((kind) => unitNames[kind]).join("・");
  return `${names}${also ? "でも" : "で"}重なる`;
}
