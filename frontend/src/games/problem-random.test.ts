import { createProblemRandom, shuffleProblemValues } from "./problem-random";

describe("createProblemRandom", () => {
  const source = "same-source";

  test("同じ入力から同じ乱数列を再現すること", () => {
    const firstRandom = createProblemRandom(source);
    const secondRandom = createProblemRandom(source);

    const first = Array.from({ length: 5 }, () => firstRandom());
    const second = Array.from({ length: 5 }, () => secondRandom());

    expect(second).toEqual(first);
  });
});

describe("shuffleProblemValues", () => {
  const values = [1, 2, 3, 4, 5] as const;
  const source = "shuffle-source";
  const original = [...values];

  test("同じ乱数列から同じ並びを再現すること", () => {
    const first = shuffleProblemValues(values, createProblemRandom(source));
    const second = shuffleProblemValues(values, createProblemRandom(source));

    expect(second).toEqual(first);
  });

  test("入力配列を変更しないこと", () => {
    shuffleProblemValues(values, createProblemRandom(source));

    expect(values).toEqual(original);
  });
});
