function padTwoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatElapsedTime(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${padTwoDigits(minutes)}:${padTwoDigits(seconds)}`;
  }

  return `${padTwoDigits(minutes)}:${padTwoDigits(seconds)}`;
}

// 基準時間は秒未満を含む式から求まるため、切り捨てると基準の意味がずれる。
export function formatElapsedTimeWithTenths(elapsedMs: number): string {
  const totalSeconds = elapsedMs / 1_000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  const secondsText = Number.isInteger(seconds)
    ? padTwoDigits(seconds)
    : seconds.toFixed(1).padStart(4, "0");
  return `${padTwoDigits(minutes)}:${secondsText}`;
}

export function formatDurationInWords(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = (milliseconds - minutes * 60_000) / 1_000;
  if (minutes === 0) {
    return `${seconds}秒`;
  }

  return seconds === 0 ? `${minutes}分` : `${minutes}分${seconds}秒`;
}
