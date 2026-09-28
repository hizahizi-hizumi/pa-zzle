import { calculateLinearScore, subtractWithFloor } from "@/games/score";

describe("calculateLinearScore", () => {
  const maximum = 40;
  const cases = [
    [1, 40],
    [0.5, 20],
    [0.51, 20],
    [0.52, 21],
    [0, 0],
    [1.5, 40],
    [-0.5, 0],
  ] as const;

  test.each(cases)("達成比率 %d を %i 点にすること", (ratio, expected) => {
    const score = calculateLinearScore(maximum, ratio);

    expect(score).toBe(expected);
  });
});

describe("subtractWithFloor", () => {
  const maximum = 20;
  const cases = [
    [0, 20],
    [5, 15],
    [20, 0],
    [25, 0],
  ] as const;

  test.each(cases)("減点 %i を %i 点にすること", (penalty, expected) => {
    const score = subtractWithFloor(maximum, penalty);

    expect(score).toBe(expected);
  });
});
