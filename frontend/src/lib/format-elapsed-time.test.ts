import {
  formatDurationInWords,
  formatElapsedTime,
  formatElapsedTimeWithTenths,
} from "@/lib/format-elapsed-time";

describe("formatElapsedTime", () => {
  const cases = [
    ["1秒未満は切り捨てる", 999, "00:00"],
    ["1時間未満は分と秒で表す", 65_400, "01:05"],
    ["1時間以上は時を加える", 3_725_000, "1:02:05"],
  ] as const;

  test.each(cases)(
    "経過時間を表示用に整形すること: %s",
    (_, elapsedMs, expected) => {
      const result = formatElapsedTime(elapsedMs);

      expect(result).toBe(expected);
    },
  );
});

describe("formatElapsedTimeWithTenths", () => {
  const cases = [
    ["端数のない秒は整数で表す", 65_000, "01:05"],
    ["端数のある秒は小数第1位まで表す", 7_500, "00:07.5"],
  ] as const;

  test.each(cases)(
    "採点基準の時間を整形すること: %s",
    (_, elapsedMs, expected) => {
      const result = formatElapsedTimeWithTenths(elapsedMs);

      expect(result).toBe(expected);
    },
  );
});

describe("formatDurationInWords", () => {
  const cases = [
    ["1分未満は秒で表す", 5_000, "5秒"],
    ["秒の端数は小数で残す", 1_250, "1.25秒"],
    ["分で割り切れれば分だけで表す", 60_000, "1分"],
    ["分と秒を続けて表す", 90_000, "1分30秒"],
  ] as const;

  test.each(cases)(
    "時間の長さを言葉で表すこと: %s",
    (_, milliseconds, expected) => {
      const result = formatDurationInWords(milliseconds);

      expect(result).toBe(expected);
    },
  );
});
