import {
  assertTsumeShogiProblem,
  createTsumeShogiProblemIdentity,
  formatTsumeShogiGenerationConditionsText,
  formatTsumeShogiProblemText,
  isTsumeShogiProblemIdentity,
  isTsumeShogiRecordedProblemIdentity,
  isTsumeShogiSolveWorkload,
  isTsumeShogiWorkloadOfIdentity,
  parseTsumeShogiGenerationConditionsText,
  parseTsumeShogiProblemText,
  type TsumeShogiProblem,
} from "@/games/tsume-shogi/problem/problem";

const problem: TsumeShogiProblem = parseTsumeShogiProblemText({
  sfen: "5s3/6k2/9/5P1+R1/9/9/9/9/9 b Sr2b4g2s4n4l17p 1",
  mainLine: ["S*3c", "3b3a", "2d2b"],
});

describe("createTsumeShogiProblemIdentity", () => {
  test("手数と候補番号を含む seed の identity を作ること", () => {
    const result = createTsumeShogiProblemIdentity(5, 3);

    expect(result).toEqual({
      generatorVersion: "2",
      seed: "ts-5-3",
      conditions: { plies: 5 },
    });
  });

  test("初手の王手の数の範囲を条件と seed に含めること", () => {
    const result = createTsumeShogiProblemIdentity(5, 3, {
      minimum: 1,
      maximum: 4,
    });

    expect(result).toEqual({
      generatorVersion: "2",
      seed: "ts-5-c1-4-3",
      conditions: { plies: 5, rootChecks: { minimum: 1, maximum: 4 } },
    });
  });

  test("起点の詰め手の種類を条件と seed に含めること", () => {
    const result = createTsumeShogiProblemIdentity(
      3,
      7,
      { minimum: 1, maximum: 4 },
      "board-move",
    );

    expect(result).toEqual({
      generatorVersion: "2",
      seed: "ts-3-c1-4-move-7",
      conditions: {
        plies: 3,
        rootChecks: { minimum: 1, maximum: 4 },
        baseMate: "board-move",
      },
    });
  });
});

describe("parseTsumeShogiGenerationConditionsText", () => {
  test.each([
    ["5", { plies: 5 }],
    ["5:1-4", { plies: 5, rootChecks: { minimum: 1, maximum: 4 } }],
    [
      "3:1-4:board-move",
      {
        plies: 3,
        rootChecks: { minimum: 1, maximum: 4 },
        baseMate: "board-move",
      },
    ],
  ] as const)("%s を読み、同じ文字列に書き戻せること", (text, expected) => {
    const conditions = parseTsumeShogiGenerationConditionsText(text);

    expect(conditions).toEqual(expected);
    expect(formatTsumeShogiGenerationConditionsText(conditions)).toBe(text);
  });

  test.each(["7", "3:1-4:drop", "3-1-4"])(
    "%s は読まずに RangeError を投げること",
    (text) => {
      expect(() => parseTsumeShogiGenerationConditionsText(text)).toThrow(
        RangeError,
      );
    },
  );
});

describe("isTsumeShogiProblemIdentity", () => {
  const cases = [
    ["今の生成器の identity", createTsumeShogiProblemIdentity(3, 0), true],
    [
      "版の違う identity",
      { generatorVersion: "0", seed: "ts-3-0", conditions: { plies: 3 } },
      false,
    ],
    [
      "扱わない手数の identity",
      { generatorVersion: "2", seed: "ts-7-0", conditions: { plies: 7 } },
      false,
    ],
    [
      "seed の無い identity",
      { generatorVersion: "2", seed: "", conditions: { plies: 3 } },
      false,
    ],
    [
      "初手の王手の数の範囲のある identity",
      createTsumeShogiProblemIdentity(3, 0, { minimum: 2, maximum: 10 }),
      true,
    ],
    [
      "起点の詰め手の種類のある identity",
      createTsumeShogiProblemIdentity(
        3,
        0,
        { minimum: 1, maximum: 4 },
        "board-move",
      ),
      true,
    ],
    [
      "扱わない起点の詰め手の種類の identity",
      {
        generatorVersion: "2",
        seed: "ts-3-c1-4-drop-0",
        conditions: {
          plies: 3,
          rootChecks: { minimum: 1, maximum: 4 },
          baseMate: "drop",
        },
      },
      false,
    ],
    [
      "初手の王手の数の範囲が逆転した identity",
      {
        generatorVersion: "2",
        seed: "ts-3-c4-1-0",
        conditions: { plies: 3, rootChecks: { minimum: 4, maximum: 1 } },
      },
      false,
    ],
    [
      "初手の王手の数の下限が0の identity",
      {
        generatorVersion: "2",
        seed: "ts-3-c0-1-0",
        conditions: { plies: 3, rootChecks: { minimum: 0, maximum: 1 } },
      },
      false,
    ],
  ] as const;

  test.each(cases)("%sを判定すること", (_, value, expected) => {
    const result = isTsumeShogiProblemIdentity(value);

    expect(result).toBe(expected);
  });
});

describe("isTsumeShogiRecordedProblemIdentity", () => {
  const cases = [
    ["今の生成器の identity", createTsumeShogiProblemIdentity(5, 3), true],
    [
      "版の違う identity（条件の形を問わない）",
      { generatorVersion: "0", seed: "ts-7-0", conditions: { depth: 7 } },
      true,
    ],
    [
      "今の版で扱えない条件の identity",
      { generatorVersion: "2", seed: "ts-7-0", conditions: { plies: 7 } },
      false,
    ],
    [
      "版の無い identity",
      { generatorVersion: "", seed: "ts-3-0", conditions: { plies: 3 } },
      false,
    ],
    [
      "seed の無い版の違う identity",
      { generatorVersion: "0", seed: "", conditions: {} },
      false,
    ],
  ] as const;

  test.each(cases)("%sを判定すること", (_, value, expected) => {
    const result = isTsumeShogiRecordedProblemIdentity(value);

    expect(result).toBe(expected);
  });
});

describe("isTsumeShogiSolveWorkload", () => {
  const workload = {
    plies: 5,
    rootChecks: 7,
    plausibleWrong: 5,
    deepDecoyCount: 1,
  };
  const cases = [
    ["作業の量", workload, true],
    ["偶数の手数", { ...workload, plies: 4 }, false],
    ["初手の王手が0の作業の量", { ...workload, rootChecks: 0 }, false],
    ["負の誤王手", { ...workload, plausibleWrong: -1 }, false],
    [
      "深い紛れがもっともらしい誤王手より多い作業の量",
      { ...workload, deepDecoyCount: 6 },
      false,
    ],
    ["整数でない値", { ...workload, rootChecks: 1.5 }, false],
    ["項目の欠けた値", { plies: 5, rootChecks: 7 }, false],
  ] as const;

  test.each(cases)("%sを判定すること", (_, value, expected) => {
    const result = isTsumeShogiSolveWorkload(value);

    expect(result).toBe(expected);
  });
});

describe("isTsumeShogiWorkloadOfIdentity", () => {
  const identity = createTsumeShogiProblemIdentity(5, 3, {
    minimum: 3,
    maximum: 12,
  });
  const cases = [
    ["手数と初手の王手が条件に合う", { plies: 5, rootChecks: 12 }, true],
    ["手数が条件と違う", { plies: 3, rootChecks: 7 }, false],
    ["初手の王手が範囲の外にある", { plies: 5, rootChecks: 2 }, false],
  ] as const;

  test.each(cases)("%s作業の量を判定すること", (_, partial, expected) => {
    const result = isTsumeShogiWorkloadOfIdentity(
      { ...partial, plausibleWrong: 1, deepDecoyCount: 0 },
      identity,
    );

    expect(result).toBe(expected);
  });

  test("初手の王手の数の範囲の無い identity では手数だけを比べること", () => {
    const result = isTsumeShogiWorkloadOfIdentity(
      { plies: 3, rootChecks: 30, plausibleWrong: 1, deepDecoyCount: 0 },
      createTsumeShogiProblemIdentity(3, 0),
    );

    expect(result).toBe(true);
  });
});

describe("assertTsumeShogiProblem", () => {
  test("作意の通りに詰む問題を受け入れること", () => {
    const act = () => assertTsumeShogiProblem(problem);

    expect(act).not.toThrow();
  });

  const invalidCases: readonly [string, TsumeShogiProblem][] = [
    ["手数が偶数", { ...problem, plies: 2 }],
    ["作意の長さが手数と違う", { ...problem, plies: 5 }],
    [
      "攻方の手が王手でない",
      parseTsumeShogiProblemText({
        sfen: "5s3/6k2/9/5P1+R1/9/9/9/9/9 b Sr2b4g2s4n4l17p 1",
        mainLine: ["S*9i", "3b3a", "2d2b"],
      }),
    ],
    [
      "作意の最後で詰まない",
      parseTsumeShogiProblemText({
        sfen: "5s3/6k2/9/5P1+R1/9/9/9/9/9 b Sr2b4g2s4n4l17p 1",
        mainLine: ["S*3c", "3b3a", "2d2c"],
      }),
    ],
    [
      "作意の手が合法手でない",
      parseTsumeShogiProblemText({
        sfen: "5s3/6k2/9/5P1+R1/9/9/9/9/9 b Sr2b4g2s4n4l17p 1",
        mainLine: ["S*3c", "3b3b", "2d2b"],
      }),
    ],
  ];

  test.each(invalidCases)("%s問題を拒否すること", (_, invalidProblem) => {
    const act = () => assertTsumeShogiProblem(invalidProblem);

    expect(act).toThrow(RangeError);
  });
});

describe("formatTsumeShogiProblemText", () => {
  test("文字列の形へ書き出して読み戻すと同じ問題になること", () => {
    const text = formatTsumeShogiProblemText(problem);

    expect(
      formatTsumeShogiProblemText(parseTsumeShogiProblemText(text)),
    ).toEqual(text);
    expect(text.mainLine).toEqual(["S*3c", "3b3a", "2d2b"]);
  });
});
