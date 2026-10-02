import {
  assertTsumeShogiProblem,
  createTsumeShogiProblemIdentity,
  formatTsumeShogiProblemText,
  isTsumeShogiProblemIdentity,
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
      generatorVersion: "1",
      seed: "ts-5-3",
      conditions: { plies: 5 },
    });
  });
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
      { generatorVersion: "1", seed: "ts-7-0", conditions: { plies: 7 } },
      false,
    ],
    [
      "seed の無い identity",
      { generatorVersion: "1", seed: "", conditions: { plies: 3 } },
      false,
    ],
  ] as const;

  test.each(cases)("%sを判定すること", (_, value, expected) => {
    const result = isTsumeShogiProblemIdentity(value);

    expect(result).toBe(expected);
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
