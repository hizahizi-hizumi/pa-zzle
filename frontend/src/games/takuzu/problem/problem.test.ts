import {
  assertTakuzuProblem,
  createTakuzuProblemIdentity,
  isTakuzuProblemIdentity,
  isTakuzuRecordedProblemIdentity,
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

describe("isTakuzuRecordedProblemIdentity", () => {
  const identity = createTakuzuProblemIdentity("single-remaining", 4, 45);
  const validCases = [
    ["今の生成器の", identity],
    [
      "生成器の版が今と違い、生成条件の形も違う",
      { generatorVersion: "0", seed: "tk-old", conditions: { size: 6 } },
    ],
  ] as const;
  const invalidCases = [
    ["生成器の版が空の", { ...identity, generatorVersion: "" }],
    [
      "生成器の版が今と違い、seed が空の",
      { ...identity, generatorVersion: "0", seed: "" },
    ],
    [
      "生成器の版が今と違い、条件が無い",
      { ...identity, generatorVersion: "0", conditions: undefined },
    ],
    [
      "今の生成器の版で盤面の大きさが違う",
      { ...identity, conditions: { ...identity.conditions, size: 10 } },
    ],
  ] as const;

  test.each(validCases)("%s identity を受け入れること", (_, value) => {
    const accepted = isTakuzuRecordedProblemIdentity(value);

    expect(accepted).toBe(true);
  });

  test.each(invalidCases)("%s値を拒否すること", (_, value) => {
    const accepted = isTakuzuRecordedProblemIdentity(value);

    expect(accepted).toBe(false);
  });
});

describe("isTakuzuSolveWorkload", () => {
  const workload = {
    emptyCellCount: 44,
    roundCount: 17,
    lineReadingRoundCount: 1,
  };
  const invalidCases = [
    ["空きマスが0の", { ...workload, emptyCellCount: 0 }],
    ["空きマスが盤面より多い", { ...workload, emptyCellCount: 65 }],
    ["局面が0の", { ...workload, roundCount: 0, lineReadingRoundCount: 0 }],
    [
      "局面が空きマスより多い",
      { emptyCellCount: 4, roundCount: 5, lineReadingRoundCount: 0 },
    ],
    [
      "行・列を読む局面が局面より多い",
      { ...workload, lineReadingRoundCount: 18 },
    ],
    ["整数でない", { ...workload, roundCount: 17.5 }],
  ] as const;

  test("8×8 の問題で成り立つ作業の量を受け入れること", () => {
    const accepted = isTakuzuSolveWorkload(workload);

    expect(accepted).toBe(true);
  });

  test.each(invalidCases)("%s値を拒否すること", (_, value) => {
    const accepted = isTakuzuSolveWorkload(value);

    expect(accepted).toBe(false);
  });
});
