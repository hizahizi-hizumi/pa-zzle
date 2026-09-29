import { getGameResultLevel } from "@/games/result";

describe("getGameResultLevel", () => {
  const cases = [
    [100, "perfect"],
    [99, "great"],
    [90, "great"],
    [89, "good"],
    [80, "good"],
    [79, "clear"],
    [0, "clear"],
  ] as const;

  test.each(cases)("評価点 %i を %s 段階として扱うこと", (score, expected) => {
    const level = getGameResultLevel(score);

    expect(level).toBe(expected);
  });
});
