import {
  createFukumenzanProblemIdentity,
  FUKUMENZAN_GENERATOR_VERSION,
  type FukumenzanProblem,
  formatFukumenzanEquation,
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
