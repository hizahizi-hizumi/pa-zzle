import { _private } from "@/games/ice-floor-maze/ui/board/IceFloorMazeBoard";

const { getIceFloorMazeSlideDurationMs } = _private;

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
