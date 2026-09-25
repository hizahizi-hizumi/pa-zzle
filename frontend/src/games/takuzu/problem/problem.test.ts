import {
  assertTakuzuProblem,
  createTakuzuProblemIdentity,
  isTakuzuProblemIdentity,
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
  const validCases = [
    ["手筋の上限がある", identity],
    ["手筋の上限が無い", createTakuzuProblemIdentity(null, 0, 12)],
  ] as const;
  const invalidCases = [
    ["生成器の版が違う", { ...identity, generatorVersion: "2" }],
    ["seed が空", { ...identity, seed: "" }],
    ["条件が無い", { ...identity, conditions: undefined }],
    [
      "盤面の大きさが違う",
      { ...identity, conditions: { ...identity.conditions, size: 10 } },
    ],
    [
      "未知の手筋の上限",
      {
        ...identity,
        conditions: { ...identity.conditions, removalTechniqueLimit: "guess" },
      },
    ],
    [
      "戻す数が負",
      {
        ...identity,
        conditions: { ...identity.conditions, extraGivenCount: -1 },
      },
    ],
  ] as const;

  test.each(validCases)("%s identity を受け入れること", (_, value) => {
    const accepted = isTakuzuProblemIdentity(value);

    expect(accepted).toBe(true);
  });

  test.each(invalidCases)("%s値を拒否すること", (_, value) => {
    const accepted = isTakuzuProblemIdentity(value);

    expect(accepted).toBe(false);
  });
});
