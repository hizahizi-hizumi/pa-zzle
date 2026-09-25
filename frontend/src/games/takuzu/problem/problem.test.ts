import {
  assertTakuzuProblem,
  createTakuzuProblemIdentity,
  isTakuzuProblemIdentity,
  isTakuzuSolveWorkload,
  type TakuzuProblem,
} from "@/games/takuzu/problem/problem";
import { parseTakuzuBoard } from "@/games/takuzu/puzzle/board";

const solution = parseTakuzuBoard(["AABB", "BBAA", "ABAB", "BABA"]);

describe("assertTakuzuProblem", () => {
  const cases: readonly [string, TakuzuProblem][] = [
    [
      "初期配置が解と食い違う問題",
      {
        givens: parseTakuzuBoard(["B...", "....", "....", "...."]),
        solution,
      },
    ],
    [
      "解がルールを満たさない問題",
      {
        givens: parseTakuzuBoard(["A...", "....", "....", "...."]),
        solution: parseTakuzuBoard(["ABAB", "BABA", "ABAB", "BABA"]),
      },
    ],
    [
      "初期配置と解の大きさが違う問題",
      {
        givens: parseTakuzuBoard(["A.", ".."]),
        solution,
      },
    ],
  ];

  test.each(cases)("%s を拒否すること", (_, problem) => {
    const act = () => assertTakuzuProblem(problem);

    expect(act).toThrow();
  });
});

describe("isTakuzuProblemIdentity", () => {
  const identity = createTakuzuProblemIdentity("single-remaining", 4, 45);

  test("生成条件から作った identity を受け入れること", () => {
    expect(isTakuzuProblemIdentity(identity)).toBe(true);
    expect(
      isTakuzuProblemIdentity(createTakuzuProblemIdentity(null, 0, 12)),
    ).toBe(true);
  });

  test.each([
    ["生成器の版が違う", { ...identity, generatorVersion: "2" }],
    ["seed が空", { ...identity, seed: "" }],
    ["条件が無い", { ...identity, conditions: undefined }],
    [
      "盤面の大きさが違う",
      { ...identity, conditions: { ...identity.conditions, size: 10 } },
    ],
    [
      "戻す数が負",
      {
        ...identity,
        conditions: { ...identity.conditions, extraGivenCount: -1 },
      },
    ],
  ])("%s値を拒否すること", (_, value) => {
    expect(isTakuzuProblemIdentity(value)).toBe(false);
  });
});

describe("isTakuzuSolveWorkload", () => {
  test("8×8 の問題で成り立つ作業の量を受け入れること", () => {
    expect(
      isTakuzuSolveWorkload({
        emptyCellCount: 44,
        roundCount: 17,
        lineReadingRoundCount: 1,
      }),
    ).toBe(true);
  });

  test.each([
    [
      "空きマスが0",
      { emptyCellCount: 0, roundCount: 1, lineReadingRoundCount: 0 },
    ],
    [
      "局面が0",
      { emptyCellCount: 44, roundCount: 0, lineReadingRoundCount: 0 },
    ],
    [
      "局面が空きマスより多い",
      { emptyCellCount: 4, roundCount: 5, lineReadingRoundCount: 0 },
    ],
    [
      "整数でない",
      { emptyCellCount: 44, roundCount: 17.5, lineReadingRoundCount: 0 },
    ],
  ])("%s値を拒否すること", (_, value) => {
    expect(isTakuzuSolveWorkload(value)).toBe(false);
  });
});
