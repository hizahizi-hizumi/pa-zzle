import {
  _private,
  assertSolitaireProblem,
  createSolitaireProblemIdentity,
  isCurrentSolitaireProblemIdentity,
  isSolitaireRecordedProblemIdentity,
  restoreSolitaireProblem,
  SOLITAIRE_GENERATOR_VERSION,
  type SolitaireProblem,
} from "@/games/solitaire/problem/problem";

const { decodeSolitaireProblem } = _private;

// 調査コード solitaire_difficulty.py の deal(3)。
const problem: SolitaireProblem = {
  columns: [
    [13],
    [28, 3],
    [19, 29, 26],
    [51, 22, 36, 10],
    [32, 6, 11, 17, 33],
    [48, 24, 31, 1, 18, 5],
    [2, 21, 44, 47, 43, 41, 27],
  ],
  stock: [
    42, 20, 7, 9, 25, 49, 39, 12, 14, 35, 16, 45, 0, 46, 4, 50, 40, 30, 38, 23,
    8, 34, 37, 15,
  ],
};
const seed = "NcDTdazWkKgGLRhwYfBSFCVsvrpbqUHJZxnMOjQtAuEyoemXIilP";

describe("createSolitaireProblemIdentity", () => {
  test("列を左から各列の奥から手前へ、続けて山札を最初にめくる札から、札ごとに1文字で並べた seed にすること", () => {
    const identity = createSolitaireProblemIdentity(problem);

    expect(identity).toEqual({
      generatorVersion: SOLITAIRE_GENERATOR_VERSION,
      seed,
      conditions: {},
    });
  });
});

describe("restoreSolitaireProblem", () => {
  const identity = createSolitaireProblemIdentity(problem);

  test("identity から同じ配り方を復号すること", () => {
    const restored = restoreSolitaireProblem(identity);

    expect(restored).toEqual({ problem, identity });
  });

  describe("読めない seed", () => {
    const invalidIdentity = { ...identity, seed: "A".repeat(52) };

    test("拒否すること", () => {
      const act = () => restoreSolitaireProblem(invalidIdentity);

      expect(act).toThrow(RangeError);
    });
  });
});

describe("decodeSolitaireProblem", () => {
  const cases = [
    ["51文字", seed.slice(1)],
    ["同じ札が2回ある", `A${seed.slice(1).replace("A", "B")}`],
    ["札にない字がある", `${seed.slice(0, -1)}!`],
  ] as const;

  test.each(cases)("%sの seed は null になること", (_, invalidSeed) => {
    const decoded = decodeSolitaireProblem(invalidSeed);

    expect(decoded).toBeNull();
  });
});

describe("assertSolitaireProblem", () => {
  const cases: readonly (readonly [string, SolitaireProblem])[] = [
    [
      "列の枚数が左から1〜7枚でない",
      {
        columns: [
          problem.columns[1]!,
          problem.columns[0]!,
          ...problem.columns.slice(2),
        ],
        stock: problem.stock,
      },
    ],
    [
      "山札が24枚でない",
      { columns: problem.columns, stock: problem.stock.slice(1) },
    ],
    [
      "同じ札を2回配る",
      { columns: problem.columns, stock: [13, ...problem.stock.slice(1)] },
    ],
    [
      "札でない番号を配る",
      { columns: problem.columns, stock: [52, ...problem.stock.slice(1)] },
    ],
  ];

  test.each(cases)("%s問題を拒否すること", (_, invalidProblem) => {
    const act = () => assertSolitaireProblem(invalidProblem);

    expect(act).toThrow(RangeError);
  });
});

describe("isCurrentSolitaireProblemIdentity", () => {
  const identity = createSolitaireProblemIdentity(problem);
  const cases = [
    ["今の版の identity", identity, true],
    ["別の版", { ...identity, generatorVersion: "0" }, false],
    ["読めない seed", { ...identity, seed: "abc" }, false],
    ["生成条件を持つ", { ...identity, conditions: { level: 1 } }, false],
    ["オブジェクトでない", seed, false],
  ] as const;

  test.each(cases)("%sなら %s を返すこと", (_, value, expected) => {
    const result = isCurrentSolitaireProblemIdentity(value);

    expect(result).toBe(expected);
  });
});

describe("isSolitaireRecordedProblemIdentity", () => {
  const identity = createSolitaireProblemIdentity(problem);
  const cases = [
    ["今の版の identity", identity, true],
    [
      "別の版で seed が文字列",
      { generatorVersion: "0", seed: "1", conditions: {} },
      true,
    ],
    ["今の版で読めない seed", { ...identity, seed: "abc" }, false],
    ["生成条件が無い", { generatorVersion: "0", seed: "1" }, false],
  ] as const;

  test.each(cases)("%sなら %s を返すこと", (_, value, expected) => {
    const result = isSolitaireRecordedProblemIdentity(value);

    expect(result).toBe(expected);
  });
});
