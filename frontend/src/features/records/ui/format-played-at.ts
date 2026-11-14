export function formatPlayedAt(playedAt: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(playedAt));
}

// ゲームのホームを開いてすぐ詳細に出すので、作るのに時間のかかる `Intl.DateTimeFormat` を使わない。
export function formatPlayedDate(playedAt: number): string {
  const date = new Date(playedAt);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function formatPlayedDay(playedAt: number): string {
  const date = new Date(playedAt);
  return `${formatPlayedDate(playedAt)}（${weekdayLabels[date.getDay()]}）`;
}

// 記録の一覧の行ごとに示すので、作るのに時間のかかる `Intl.DateTimeFormat` を使わない。
export function formatPlayedTime(playedAt: number): string {
  const date = new Date(playedAt);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
