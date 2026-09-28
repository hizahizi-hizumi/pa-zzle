import {
  assertReflectionProblem,
  createReflectionProblemIdentity,
  isReflectionProblemIdentity,
  isReflectionRecordedProblemIdentity,
  type ReflectionProblem,
} from "@/games/reflection/problem/problem";
import {
  countReflectionBoardPieces,
  createEmptyReflectionInventory,
  parseReflectionBoard,
} from "@/games/reflection/puzzle/board";
import { computeReflectionClues } from "@/games/reflection/puzzle/laser";

const solution = parseReflectionBoard([
  "/....",
  ".o...",
  ".....",
  "...@.",
  ".....",
]);
const problem: ReflectionProblem = {
  size: 5,
  inventory: countReflectionBoardPieces(solution),
  clues: computeReflectionClues(solution),
  solution,
};

describe("createReflectionProblemIdentity", () => {
  test("条件と候補番号を含む seed の identity を作ること", () => {
    const result = createReflectionProblemIdentity(7, 10, 3);

    expect(result).toEqual({
      generatorVersion: "2",
      seed: "rf-7-10-3",
      conditions: { size: 7, pieceCount: 10 },
    });
  });
});

describe("assertReflectionProblem", () => {
  test("解・手持ち・ヒントが揃った問題を受け入れること", () => {
    const act = () => assertReflectionProblem(problem);

    expect(act).not.toThrow();
  });

  const invalidCases: readonly [string, ReflectionProblem][] = [
    ["大きさが解と違う問題", { ...problem, size: 6 }],
    [
      "手持ちが解と違う問題",
      {
        ...problem,
        inventory: { ...createEmptyReflectionInventory(), slash: 3 },
      },
    ],
    [
      "ヒントが解と違う問題",
      {
        ...problem,
        clues: computeReflectionClues(
          parseReflectionBoard(["\\....", ".o...", ".....", "...@.", "....."]),
        ),
      },
    ],
  ];

  test.each(invalidCases)("%s を拒否すること", (_, invalidProblem) => {
    const act = () => assertReflectionProblem(invalidProblem);

    expect(act).toThrow();
  });
});

describe("isReflectionProblemIdentity", () => {
  const identity = createReflectionProblemIdentity(6, 8, 0);
  const invalidCases = [
    ["生成器の版が違う", { ...identity, generatorVersion: "1" }],
    ["seed が空", { ...identity, seed: "" }],
    ["条件が無い", { ...identity, conditions: undefined }],
    [
      "盤面の大きさが対象外",
      { ...identity, conditions: { ...identity.conditions, size: 12 } },
    ],
    [
      "ピース数が0",
      { ...identity, conditions: { ...identity.conditions, pieceCount: 0 } },
    ],
    [
      "ピース数が全マス",
      { ...identity, conditions: { ...identity.conditions, pieceCount: 36 } },
    ],
  ] as const;

  test("現在の生成器の identity を受け入れること", () => {
    const accepted = isReflectionProblemIdentity(identity);

    expect(accepted).toBe(true);
  });

  test.each(invalidCases)("%s identity を拒否すること", (_, value) => {
    const accepted = isReflectionProblemIdentity(value);

    expect(accepted).toBe(false);
  });
});

describe("isReflectionRecordedProblemIdentity", () => {
  const identity = createReflectionProblemIdentity(5, 4, 1);
  const cases = [
    ["現在の生成器の identity", identity, true],
    [
      "別の版の identity",
      { generatorVersion: "0", seed: "old", conditions: { legacy: true } },
      true,
    ],
    [
      "現在の版で条件が不正な identity",
      { ...identity, conditions: { size: 4, pieceCount: 4 } },
      false,
    ],
    ["版が空の identity", { ...identity, generatorVersion: "" }, false],
  ] as const;

  test.each(cases)("%s を判定すること", (_, value, expected) => {
    const accepted = isReflectionRecordedProblemIdentity(value);

    expect(accepted).toBe(expected);
  });
});
