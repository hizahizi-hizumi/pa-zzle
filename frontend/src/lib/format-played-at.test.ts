import { formatPlayedDate } from "@/lib/format-played-at";

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
