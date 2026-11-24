import researchCases from "@/games/fukumenzan/problem/generation/research-difficulty-cases.json";
import {
  createFukumenzanProblemIdentity,
  FUKUMENZAN_GENERATOR_VERSION,
  type FukumenzanProblem,
  formatFukumenzanEquation,
  getFukumenzanSameProblemKey,
  isCurrentFukumenzanProblemIdentity,
  isFukumenzanRecordedProblemIdentity,
  parseFukumenzanEquation,
} from "@/games/fukumenzan/problem/problem";

const problem: FukumenzanProblem = {
  addends: ["NNV", "UFN", "NTT"],
  result: "NFVT",
};

describe("parseFukumenzanEquation", () => {
  test("式の文字列から足す数と答えを読むこと", () => {
    const parsed = parseFukumenzanEquation("NNV+UFN+NTT=NFVT");

    expect(parsed).toEqual(problem);
  });

  test.each(["NNV=NFVT", "NNV+UFN", "nnv+ufn=nfvt", "NNV+UFN=NFVT=A"])(
    "形の読めない %s には null を返すこと",
    (text) => {
      const parsed = parseFukumenzanEquation(text);

      expect(parsed).toBeNull();
    },
  );
});

describe("formatFukumenzanEquation", () => {
  test("足す数を + で、答えを = でつなぐこと", () => {
    const text = formatFukumenzanEquation(problem);

    expect(text).toBe("NNV+UFN+NTT=NFVT");
  });
});

describe("createFukumenzanProblemIdentity", () => {
  test("式の文字列を seed にし、足す数の桁の数を条件にすること", () => {
    const identity = createFukumenzanProblemIdentity(problem);

    expect(identity).toEqual({
      generatorVersion: FUKUMENZAN_GENERATOR_VERSION,
      seed: "NNV+UFN+NTT=NFVT",
      conditions: { addendLengths: [3, 3, 3] },
    });
  });
});

describe("isCurrentFukumenzanProblemIdentity", () => {
  const identity = createFukumenzanProblemIdentity(problem);
  const cases = [
    ["今の identity", identity, true],
    [
      "条件が式と合わない",
      { ...identity, conditions: { addendLengths: [3, 3] } },
      false,
    ],
    [
      "問題に使わない文字を含む",
      {
        ...identity,
        seed: "SEND+MORE=MONEY",
        conditions: { addendLengths: [4, 4] },
      },
      false,
    ],
    ["版が違う", { ...identity, generatorVersion: "0" }, false],
  ] as const;

  test.each(cases)("%s を見分けること", (_, value, expected) => {
    const isCurrent = isCurrentFukumenzanProblemIdentity(value);

    expect(isCurrent).toBe(expected);
  });
});

describe("isFukumenzanRecordedProblemIdentity", () => {
  const olderIdentity = {
    generatorVersion: "0",
    seed: "older",
    conditions: {},
  };

  test("版が違う記録の identity も読むこと", () => {
    const isRecorded = isFukumenzanRecordedProblemIdentity(olderIdentity);

    expect(isRecorded).toBe(true);
  });
});

describe("getFukumenzanSameProblemKey", () => {
  const relabeledCases = [
    ["文字を付け替えた式", { addends: ["XXK", "PRX", "XTT"], result: "XRKT" }],
    [
      "足す数を並べ替えた式",
      { addends: ["NTT", "NNV", "UFN"], result: "NFVT" },
    ],
  ] as const;
  const differentProblem: FukumenzanProblem = {
    addends: ["NNV", "UFN", "NTV"],
    result: "NFVT",
  };

  test.each(relabeledCases)("%s を同じ問題にすること", (_, relabeled) => {
    const keys = [problem, relabeled].map(getFukumenzanSameProblemKey);

    expect(keys[0]).toBe(keys[1]);
  });

  test("文字の並びが違う式を別の問題にすること", () => {
    const keys = [problem, differentProblem].map(getFukumenzanSameProblemKey);

    expect(keys[0]).not.toBe(keys[1]);
  });
});

describe("研究用の期待値の同じ問題のキー", () => {
  const cases = researchCases.sameProblem.flatMap(({ equation, key, sameAs }) =>
    [equation, ...sameAs].map((text) => [text, key] as const),
  );

  test.each(cases)("%s のキーが %s になること", (text, expected) => {
    const key = getFukumenzanSameProblemKey(parseFukumenzanEquation(text)!);

    expect(key).toBe(expected);
  });
});
