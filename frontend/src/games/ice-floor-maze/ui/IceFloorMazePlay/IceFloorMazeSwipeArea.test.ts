import { _private } from "@/games/ice-floor-maze/ui/IceFloorMazePlay/IceFloorMazeSwipeArea";

const { getSwipeDirection } = _private;

describe("getSwipeDirection", () => {
  const cases = [
    ["上へ閾値ちょうど", 0, -18, "up"],
    ["右へ斜め40度", 24, 20, "right"],
    ["下へ斜め40度", -20, 24, "down"],
    ["左", -30, 0, "left"],
    ["閾値に届かない揺れ", 12, -12, null],
  ] as const;

  test.each(cases)("%sは %s を返すこと", (_, deltaX, deltaY, expected) => {
    const result = getSwipeDirection(deltaX, deltaY);

    expect(result).toBe(expected);
  });
});
