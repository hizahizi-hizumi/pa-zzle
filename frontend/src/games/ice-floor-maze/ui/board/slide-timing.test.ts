import {
  getIceFloorMazeBlockContactMs,
  getIceFloorMazeSlideDurationMs,
  getIceFloorMazeSlideProgressMs,
  getIceFloorMazeSnowPushDelayMs,
} from "@/games/ice-floor-maze/ui/board/slide-timing";

describe("getIceFloorMazeSlideDurationMs", () => {
  const cases = [
    [1, 77],
    [5, 205],
    [11, 397],
    [13, 400],
  ] as const;

  test.each(cases)(
    "%i マスの滑りは %i ミリ秒にすること",
    (distance, expected) => {
      const result = getIceFloorMazeSlideDurationMs(distance);

      expect(result).toBe(expected);
    },
  );
});

describe("getIceFloorMazeSlideProgressMs", () => {
  const cases = [
    [5, 0, 0],
    [5, 2, 82],
    [5, 5, 205],
  ] as const;

  test.each(cases)(
    "%i マスの滑りで %i マス進むまでを %i ミリ秒にすること",
    (distance, cells, expected) => {
      const result = getIceFloorMazeSlideProgressMs(distance, cells);

      expect(result).toBe(expected);
    },
  );
});

describe("getIceFloorMazeSnowPushDelayMs", () => {
  test("駒が雪のマスへ入り始める、最後の1マスを進み始めた時刻にすること", () => {
    // 3マス滑って3マス目の雪を押し出す。滑りは 141 ミリ秒で、2マス進むまでが 94 ミリ秒。
    const result = getIceFloorMazeSnowPushDelayMs({ path: [1, 2, 3] });

    expect(result).toBe(94);
  });
});

describe("getIceFloorMazeBlockContactMs", () => {
  test("駒が塊の元のマスの手前まで進んで塊に触れる時刻にすること", () => {
    // 0 から右へ5マス滑る。2マス進んだところで塊 3 に触れ、塊を 6 まで押して 5 で止まる。
    const result = getIceFloorMazeBlockContactMs({ path: [1, 2, 3, 4, 5] }, 3);

    expect(result).toBe(82);
  });
});
