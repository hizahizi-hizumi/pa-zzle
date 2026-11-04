import {
  type AbandonedPlayAttempt,
  getAbandonedPlayAttempts,
  type PlayAttempt,
} from "@/records/play-attempt";
import type { PlayRecord } from "@/records/play-record";

/** 遊んだ時間の流れの1件。クリアしたプレイはクリアした時刻、離脱したプレイは離れた時刻に置く。 */
export type PlayTimelineEntry =
  | { kind: "cleared"; playedAt: number; record: PlayRecord }
  | { kind: "abandoned"; playedAt: number; attempt: AbandonedPlayAttempt };

/** 遊んだ日ごとのまとまり。 */
export type PlayTimelineDay = {
  /** その日の0時（端末の時刻）の時刻。 */
  dayStart: number;
  /** 新しい順。 */
  entries: readonly PlayTimelineEntry[];
};

/** カレンダーのマスに示す、その日に遊んだ量の段階。0 は遊んでいない日。 */
export type PlayAmountLevel = 0 | 1 | 2 | 3;

export type PlayCalendarDay = {
  dayStart: number;
  /** まだ来ていない日は `null`。 */
  level: PlayAmountLevel | null;
};

/** 日曜から土曜の7日。 */
export type PlayCalendarWeek = readonly PlayCalendarDay[];

/** 記録画面のカレンダーに示す週の数。 */
export const PLAY_CALENDAR_WEEK_COUNT = 13;

const DAYS_PER_WEEK = 7;

/**
 * その日に遊んだ数を、遊んだ量の段階に分ける下限。段階は日ごとに独立して決め、ほかの日の多さに引きずられないようにする。
 */
const playAmountLevelMinimums = [
  { level: 3, minimum: 6 },
  { level: 2, minimum: 3 },
  { level: 1, minimum: 1 },
] as const satisfies readonly { level: PlayAmountLevel; minimum: number }[];

/** 完了記録と、離脱した試行（完了記録のある試行は除く）を、遊んだ時刻の新しい順に並べる。 */
export function listPlayTimelineEntries(
  records: readonly PlayRecord[],
  attempts: readonly PlayAttempt[],
): PlayTimelineEntry[] {
  const entries: PlayTimelineEntry[] = [
    ...records.map((record) => ({
      kind: "cleared" as const,
      playedAt: record.completedAt,
      record,
    })),
    ...getAbandonedPlayAttempts(attempts, records).map((attempt) => ({
      kind: "abandoned" as const,
      playedAt: attempt.abandonment.abandonedAt,
      attempt,
    })),
  ];
  return entries.sort((left, right) => right.playedAt - left.playedAt);
}

/** 時刻を含む日の0時（端末の時刻）の時刻。 */
export function getDayStart(time: number): number {
  const date = new Date(time);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/** 新しい順の時間の流れを、遊んだ日ごとにまとめる。日も新しい順。 */
export function groupPlayTimelineByDay(
  entries: readonly PlayTimelineEntry[],
): PlayTimelineDay[] {
  const days: { dayStart: number; entries: PlayTimelineEntry[] }[] = [];
  for (const entry of entries) {
    const dayStart = getDayStart(entry.playedAt);
    const lastDay = days.at(-1);
    if (lastDay?.dayStart === dayStart) {
      lastDay.entries.push(entry);
    } else {
      days.push({ dayStart, entries: [entry] });
    }
  }
  return days;
}

export function getPlayAmountLevel(playCount: number): PlayAmountLevel {
  return (
    playAmountLevelMinimums.find(({ minimum }) => playCount >= minimum)
      ?.level ?? 0
  );
}

function addDays(dayStart: number, days: number): number {
  const date = new Date(dayStart);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
  ).getTime();
}

/**
 * 今日を含む週までの直近の週を、日曜始まりの週ごとに、古い週から並べる。各日には、その日の時間の流れの件数から遊んだ量の段階を添える。
 * 今日より後の日は、まだ来ていない日とする。`entries` は新しい順。
 */
export function createPlayCalendar(
  entries: readonly PlayTimelineEntry[],
  now: number,
  weekCount: number = PLAY_CALENDAR_WEEK_COUNT,
): PlayCalendarWeek[] {
  const today = getDayStart(now);
  const firstDay = addDays(
    today,
    -new Date(today).getDay() - (weekCount - 1) * DAYS_PER_WEEK,
  );
  const playCounts = new Map<number, number>();
  for (const { playedAt } of entries) {
    if (playedAt < firstDay) {
      // 新しい順なので、ここから先はカレンダーより前の日だけになる。
      break;
    }
    const dayStart = getDayStart(playedAt);
    playCounts.set(dayStart, (playCounts.get(dayStart) ?? 0) + 1);
  }

  return Array.from({ length: weekCount }, (_, weekIndex) =>
    Array.from({ length: DAYS_PER_WEEK }, (_, dayIndex) => {
      const dayStart = addDays(firstDay, weekIndex * DAYS_PER_WEEK + dayIndex);
      return {
        dayStart,
        level:
          dayStart > today
            ? null
            : getPlayAmountLevel(playCounts.get(dayStart) ?? 0),
      };
    }),
  );
}
