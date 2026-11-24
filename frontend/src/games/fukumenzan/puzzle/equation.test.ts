import {
  assertFukumenzanEquation,
  type FukumenzanEquation,
  getFukumenzanEquationStructure,
  listFukumenzanLetters,
} from "@/games/fukumenzan/puzzle/equation";

describe("listFukumenzanLetters", () => {
  const equation: FukumenzanEquation = {
    addends: ["BYK", "KTK"],
    result: "TKHH",
  };

  test("足す数を上から、答えを最後に、初めて出た順に並べること", () => {
    const letters = listFukumenzanLetters(equation);

    expect(letters).toEqual(["B", "Y", "K", "T", "H"]);
  });
});

describe("getFukumenzanEquationStructure", () => {
  describe("答えが1桁長い3つの足し算の場合", () => {
    const equation: FukumenzanEquation = {
      addends: ["NNV", "UFN", "NTT"],
      result: "NFVT",
    };

    test("2桁以上の数の先頭の文字を、文字の番号の順に返すこと", () => {
      const { leadingLetters } = getFukumenzanEquationStructure(equation);

      // N V U F T
      expect(leadingLetters).toEqual([0, 2]);
    });

    test("一の位から順に、その桁まで届く足す数の文字と答えの文字を返すこと", () => {
      const { columns } = getFukumenzanEquationStructure(equation);

      expect(columns).toEqual([
        { addendLetters: [1, 0, 4], resultLetter: 4 },
        { addendLetters: [0, 3, 4], resultLetter: 1 },
        { addendLetters: [0, 2, 0], resultLetter: 3 },
        { addendLetters: [], resultLetter: 0 },
      ]);
    });
  });

  describe("1桁の足す数がある場合", () => {
    const equation: FukumenzanEquation = {
      addends: ["AB", "C"],
      result: "DE",
    };

    test("1桁の数の文字は先頭の文字に数えないこと", () => {
      const { leadingLetters } = getFukumenzanEquationStructure(equation);

      // A B C D E
      expect(leadingLetters).toEqual([0, 3]);
    });
  });
});

describe("assertFukumenzanEquation", () => {
  const validEquations: readonly [string, FukumenzanEquation][] = [
    ["答えが足す数と同じ長さ", { addends: ["AB", "CD"], result: "EF" }],
    [
      "足す数3つで答え7桁",
      { addends: ["ABCDEF", "GHABCD", "EFGH"], result: "JABCDEF" },
    ],
  ];
  const invalidEquations: readonly [string, FukumenzanEquation][] = [
    ["足す数が1つ", { addends: ["AB"], result: "AB" }],
    ["足す数が4つ", { addends: ["AB", "CD", "EF", "GH"], result: "JKL" }],
    ["小文字を含む", { addends: ["Ab", "CD"], result: "EFG" }],
    ["答えが足す数より短い", { addends: ["ABC", "DE"], result: "FG" }],
    ["答えが2桁長い", { addends: ["AB", "CD"], result: "EFGH" }],
    ["答えが8桁", { addends: ["ABCDEFG", "ABCDEFG"], result: "HABCDEFG" }],
    ["文字が11個", { addends: ["ABCDE", "FGHJK"], result: "LABCDE" }],
  ];

  test.each(validEquations)("%s の式を受け付けること", (_, equation) => {
    const act = () => assertFukumenzanEquation(equation);

    expect(act).not.toThrow();
  });

  test.each(invalidEquations)("%s の式を拒むこと", (_, equation) => {
    const act = () => assertFukumenzanEquation(equation);

    expect(act).toThrow(RangeError);
  });
});
