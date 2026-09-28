import type { ReflectionEntry } from "@/games/reflection/puzzle/laser";

const sideLabels = {
  top: "上",
  right: "右",
  bottom: "下",
  left: "左",
} as const satisfies Record<ReflectionEntry["side"], string>;

/** 外周の位置の読み方。例: 上の辺の左から2列目は「上2列」。 */
export function formatReflectionEntry({
  side,
  index,
}: ReflectionEntry): string {
  const unit = side === "top" || side === "bottom" ? "列" : "行";
  return `${sideLabels[side]}${index + 1}${unit}`;
}
