export function formatPlayedAt(playedAt: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(playedAt));
}

/** 遊んだ日を、時刻を付けずに月日で示す。 */
export function formatPlayedDate(playedAt: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(playedAt));
}
