import type { PlayAttempt } from "@/records/play-attempt";
import type { PlayRecord } from "@/records/play-record";
import {
  createPlayCalendar,
  getPlayAmountLevel,
  groupPlayTimelineByDay,
  listPlayTimelineEntries,
  type PlayTimelineEntry,
} from "@/records/play-timeline";

function at(month: number, day: number, hour: number): number {
  return new Date(2026, month - 1, day, hour).getTime();
}

function createRecord(startedAt: number, completedAt: number): PlayRecord {
  return {
    id: `test-game:${startedAt}:${completedAt}`,
    gameId: "test-game",
    startedAt,
    completedAt,
    payloadVersion: 1,
    payload: {},
  };
}

function createAttempt(
  startedAt: number,
  abandonedAt: number | null,
): PlayAttempt {
  return {
    gameId: "test-game",
    startedAt,
    start: { difficulty: "1", problemIdentity: { seed: String(startedAt) } },
    abandonment:
      abandonedAt === null ? null : { abandonedAt, progress: { elapsedMs: 1 } },
  };
}

function toPlayedAt(entries: readonly PlayTimelineEntry[]): number[] {
  return entries.map(({ playedAt }) => playedAt);
}

describe("listPlayTimelineEntries", () => {
  const olderRecord = createRecord(at(10, 30, 9), at(10, 30, 10));
  const newerRecord = createRecord(at(11, 1, 9), at(11, 1, 10));
  const abandoned = createAttempt(at(10, 31, 9), at(10, 31, 11));
  // 離脱を記録したあとに完了記録が残った試行は、クリアとして完了記録の方だけを並べる。
  const clearedAfterAbandon = createAttempt(
    newerRecord.startedAt,
    at(11, 1, 9) + 1,
  );
  const unfinished = createAttempt(at(11, 1, 12), null);

  test("完了記録と離脱した試行を、遊んだ時刻の新しい順に並べること", () => {
    const entries = listPlayTimelineEntries(
      [olderRecord, newerRecord],
      [abandoned, clearedAfterAbandon, unfinished],
    );

    expect(entries.map(({ kind }) => kind)).toEqual([
      "cleared",
      "abandoned",
      "cleared",
    ]);
    expect(toPlayedAt(entries)).toEqual([
      newerRecord.completedAt,
      at(10, 31, 11),
      olderRecord.completedAt,
    ]);
  });
});

describe("groupPlayTimelineByDay", () => {
  const entries = listPlayTimelineEntries(
    [
      createRecord(at(11, 1, 20), at(11, 1, 21)),
      createRecord(at(11, 1, 0), at(11, 1, 0)),
      createRecord(at(10, 30, 23), at(10, 30, 23)),
    ],
    [],
  );

  test("遊んだ日ごとに、日も中のプレイも新しい順にまとめること", () => {
    const days = groupPlayTimelineByDay(entries);

    expect(
      days.map(({ dayStart, entries: dayEntries }) => [
        dayStart,
        toPlayedAt(dayEntries),
      ]),
    ).toEqual([
      [at(11, 1, 0), [at(11, 1, 21), at(11, 1, 0)]],
      [at(10, 30, 0), [at(10, 30, 23)]],
    ]);
  });
});

describe("getPlayAmountLevel", () => {
  const cases = [
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 2],
    [5, 2],
    [6, 3],
    [40, 3],
  ] as const;

  test.each(cases)(
    "その日に遊んだ数から段階を決めること: %s件",
    (count, expected) => {
      const level = getPlayAmountLevel(count);

      expect(level).toBe(expected);
    },
  );
});

describe("createPlayCalendar", () => {
  // 2026-11-04 は水曜日。
  const now = at(11, 4, 15);
  const entries = listPlayTimelineEntries(
    [
      ...Array.from({ length: 6 }, (_, index) =>
        createRecord(at(11, 2, index), at(11, 2, index)),
      ),
      createRecord(at(11, 1, 9), at(11, 1, 9)),
      createRecord(at(8, 1, 9), at(8, 1, 9)),
    ],
    [createAttempt(at(11, 2, 20), at(11, 2, 21))],
  );

  test("今日を含む週までの13週を、日曜始まりの週ごとに古い週から並べること", () => {
    const weeks = createPlayCalendar(entries, now);

    expect(weeks).toHaveLength(13);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]?.[0]?.dayStart).toBe(at(8, 9, 0));
    expect(weeks[12]?.[0]?.dayStart).toBe(at(11, 1, 0));
  });

  test("各日に、その日に遊んだ数から求めた段階を添え、今日より後の日はまだ来ていない日とすること", () => {
    const lastWeek = createPlayCalendar(entries, now)[12];

    expect(lastWeek?.map(({ level }) => level)).toEqual([
      1,
      3,
      0,
      0,
      null,
      null,
      null,
    ]);
  });
});
