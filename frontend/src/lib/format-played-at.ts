export function formatPlayedAt(playedAt: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(playedAt));
}

/**
 * 遊んだ日を、時刻を付けずに月日（`ja-JP` の数字の月日と同じ `月/日`）で示す。
 * ゲームのホームを開いてすぐ詳細に出すので、作るのに時間のかかる `Intl.DateTimeFormat` を使わない。
 */
export function formatPlayedDate(playedAt: number): string {
  const date = new Date(playedAt);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** 遊んだ日を、月日に曜日を添えて `11/1（日）` の形で示す。記録の日ごとの見出しに使う。 */
export function formatPlayedDay(playedAt: number): string {
  const date = new Date(playedAt);
  return `${formatPlayedDate(playedAt)}（${weekdayLabels[date.getDay()]}）`;
}

/**
 * 遊んだ時刻を、日付を付けずに `ja-JP` の2桁の時分（`09:05`）で示す。
 * 記録の一覧の行ごとに示すので、作るのに時間のかかる `Intl.DateTimeFormat` を使わない。
 */
export function formatPlayedTime(playedAt: number): string {
  const date = new Date(playedAt);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
