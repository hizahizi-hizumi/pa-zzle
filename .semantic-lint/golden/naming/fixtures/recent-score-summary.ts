import { loadPlayRecords } from "@/records/storage";

export function summarizeRecentScores(limit: number) {
  const data = loadPlayRecords();
  const recentRecords = data.slice(-limit);
  let tmp = 0;

  for (let index = 0; index < recentRecords.length; index += 1) {
    tmp += recentRecords[index]?.score ?? 0;
  }

  const x = recentRecords.length;
  const averageScore = x === 0 ? 0 : tmp / x;

  return { averageScore, recordCount: x };
}
