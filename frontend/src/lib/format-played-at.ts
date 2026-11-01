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
