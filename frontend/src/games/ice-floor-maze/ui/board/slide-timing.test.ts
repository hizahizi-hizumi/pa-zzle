import {
  getIceFloorMazeSlideDurationMs,
  getIceFloorMazeSlideProgressMs,
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
