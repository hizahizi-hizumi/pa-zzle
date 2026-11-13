import type { PlayAmountLevel } from "@/records/play-timeline";

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
