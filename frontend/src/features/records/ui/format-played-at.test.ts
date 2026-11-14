import {
  formatPlayedDate,
  formatPlayedDay,
  formatPlayedTime,
} from "@/features/records/ui/format-played-at";

describe("formatPlayedDate", () => {
  const cases = [
    [new Date(2026, 9, 14, 23, 59).getTime(), "10/14"],
    [new Date(2026, 0, 3, 0, 0).getTime(), "1/3"],
  ] as const;

  test.each(cases)(
    "ja-JP の数字の月日と同じ書き方で示すこと: %s",
    (playedAt, expected) => {
      const formatted = formatPlayedDate(playedAt);

      expect(formatted).toBe(expected);
      expect(formatted).toBe(
        new Intl.DateTimeFormat("ja-JP", {
          month: "numeric",
          day: "numeric",
        }).format(playedAt),
      );
    },
  );
});

describe("formatPlayedDay", () => {
  const cases = [
    [new Date(2026, 10, 1, 21, 0).getTime(), "11/1（日）"],
    [new Date(2026, 9, 31, 0, 0).getTime(), "10/31（土）"],
  ] as const;

  test.each(cases)("月日に曜日を添えて示すこと: %s", (playedAt, expected) => {
    const formatted = formatPlayedDay(playedAt);

    expect(formatted).toBe(expected);
  });
});

describe("formatPlayedTime", () => {
  const cases = [
    [new Date(2026, 9, 14, 9, 5).getTime(), "09:05"],
    [new Date(2026, 0, 3, 23, 59).getTime(), "23:59"],
  ] as const;

  test.each(cases)(
    "ja-JP の2桁の時分と同じ書き方で示すこと: %s",
    (playedAt, expected) => {
      const formatted = formatPlayedTime(playedAt);

      expect(formatted).toBe(expected);
      expect(formatted).toBe(
        new Intl.DateTimeFormat("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(playedAt),
      );
    },
  );
});
