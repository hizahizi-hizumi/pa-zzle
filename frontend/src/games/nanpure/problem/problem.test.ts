import {
  createNanpureProblemIdentity,
  isNanpureProblemIdentity,
  isNanpureRecordedProblemIdentity,
  NANPURE_GENERATOR_VERSION,
} from "@/games/nanpure/problem/problem";

describe("createNanpureProblemIdentity", () => {
  test("手筋の上限と候補番号を seed に含めること", () => {
    const identity = createNanpureProblemIdentity("x-wing", 160);

    expect(identity).toEqual({
      generatorVersion: NANPURE_GENERATOR_VERSION,
      seed: "np-x-wing-160",
      conditions: { removalTechniqueLimit: "x-wing" },
    });
  });

  test("一意解だけを保つ条件を uniqueness と表すこと", () => {
    const identity = createNanpureProblemIdentity(null, 7);

    expect(identity.seed).toBe("np-uniqueness-7");
  });
});

describe("isNanpureProblemIdentity", () => {
  const valid = createNanpureProblemIdentity("naked-pair", 1);
  const cases = [
    ["今の生成器の identity", valid, true],
    [
      "一意解だけを保つ条件の identity",
      createNanpureProblemIdentity(null, 1),
      true,
    ],
    ["生成器の版が違う", { ...valid, generatorVersion: "1" }, false],
    [
      "手筋の上限が知らない名前",
      { ...valid, conditions: { removalTechniqueLimit: "chain" } },
      false,
    ],
    ["seed が空", { ...valid, seed: "" }, false],
    ["オブジェクトでない", "np-naked-pair-1", false],
  ] as const;

  test.each(cases)("%s を %s と判定すること", (_, value, expected) => {
    const result = isNanpureProblemIdentity(value);

    expect(result).toBe(expected);
  });
});

describe("isNanpureRecordedProblemIdentity", () => {
  const valid = createNanpureProblemIdentity("naked-pair", 1);
  const cases = [
    ["今の生成器の identity", valid, true],
    [
      "3段階の生成器の identity",
      {
        generatorVersion: "1",
        seed: "nanpure-seed",
        conditions: { clueCount: 32 },
        generationAttempt: 1,
      },
      true,
    ],
    [
      "今の版で手筋の上限が知らない名前",
      { ...valid, conditions: { removalTechniqueLimit: "chain" } },
      false,
    ],
    ["生成条件が無い", { generatorVersion: "1", seed: "nanpure-seed" }, false],
    ["seed が空", { ...valid, generatorVersion: "1", seed: "" }, false],
  ] as const;

  test.each(cases)("%s を %s と判定すること", (_, value, expected) => {
    const result = isNanpureRecordedProblemIdentity(value);

    expect(result).toBe(expected);
  });
});
