import type { PlayAmountLevel } from "@/records/play-timeline";

/**
 * 遊んだ量の段階ごとのマスの塗り。評価段階の色と取り違えないよう、色を持たない前景の濃さだけで分ける。
 * まだ来ていない日は塗らずに場所だけを取る。
 */
const playAmountClassNames: Record<PlayAmountLevel, string> = {
  0: "bg-muted",
  1: "bg-foreground/25",
  2: "bg-foreground/55",
  3: "bg-foreground/90",
};

export function getPlayCalendarDayClassName(
  level: PlayAmountLevel | null,
): string {
  return level === null ? "bg-transparent" : playAmountClassNames[level];
}
