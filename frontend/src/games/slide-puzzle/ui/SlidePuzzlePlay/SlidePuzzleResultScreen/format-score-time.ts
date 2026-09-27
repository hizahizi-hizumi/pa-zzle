export function formatScoreTime(elapsedMs: number): string {
  const totalSeconds = elapsedMs / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  const secondsText = Number.isInteger(seconds)
    ? String(seconds).padStart(2, "0")
    : seconds.toFixed(1).padStart(4, "0");
  return `${String(minutes).padStart(2, "0")}:${secondsText}`;
}
