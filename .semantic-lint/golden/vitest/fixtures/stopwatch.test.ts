import { beforeEach, describe, expect, test } from "vitest";

import { createStopwatch, formatLap } from "./stopwatch";

describe("createStopwatch", () => {
  const stopwatch = createStopwatch();

  test("開始した時刻から経過時間を数えること", () => {
    stopwatch.start(0);

    const elapsed = stopwatch.elapsed(1_000);

    expect(elapsed).toBe(1_000);
  });

  test("停止した後は経過時間を増やさないこと", () => {
    stopwatch.stop(2_000);

    const elapsed = stopwatch.elapsed(5_000);

    expect(elapsed).toBe(2_000);
  });
});

describe("formatLap", () => {
  let lapMs: number;
  let expected: string;

  beforeEach(() => {
    lapMs = 61_000;
    expected = "1:01";
  });

  test("分と2桁の秒で表すこと", () => {
    const text = formatLap(lapMs);

    expect(text).toBe(expected);
  });
});
