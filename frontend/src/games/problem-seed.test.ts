import {
  createProblemSeed,
  createProblemSeededRandom,
  shuffleProblemValues,
} from "@/games/problem-seed";

describe("createProblemSeed", () => {
  test("32桁の16進数として問題を識別できるseedを生成すること", () => {
    const seed = createProblemSeed();

    expect(seed).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("createProblemSeededRandom", () => {
  const seed = "same-source";

  test("同じ入力から同じ乱数列を再現すること", () => {
    const firstRandom = createProblemSeededRandom(seed);
    const secondRandom = createProblemSeededRandom(seed);

    const first = Array.from({ length: 5 }, () => firstRandom());
    const second = Array.from({ length: 5 }, () => secondRandom());

    expect(second).toEqual(first);
  });
});

describe("shuffleProblemValues", () => {
  const values = [1, 2, 3, 4, 5] as const;
  const seed = "shuffle-source";
  const original = [...values];

  test("同じ乱数列から同じ並びを再現すること", () => {
    const first = shuffleProblemValues(values, createProblemSeededRandom(seed));
    const second = shuffleProblemValues(
      values,
      createProblemSeededRandom(seed),
    );

    expect(second).toEqual(first);
  });

  test("入力配列を変更しないこと", () => {
    shuffleProblemValues(values, createProblemSeededRandom(seed));

    expect(values).toEqual(original);
  });
});
