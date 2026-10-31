import {
  assertHamiltonianPathProblem,
  countHamiltonianPathOpenCells,
  createHamiltonianPathProblemIdentity,
  HAMILTONIAN_PATH_GENERATOR_VERSION,
  type HamiltonianPathProblem,
  type HamiltonianPathSolveWorkload,
  isHamiltonianPathProblemIdentity,
  isHamiltonianPathRecordedProblemIdentity,
  isHamiltonianPathSolveWorkload,
  isHamiltonianPathWorkloadOfIdentity,
} from "@/games/hamiltonian-path/problem/problem";
import { parseHamiltonianPathBoard } from "@/games/hamiltonian-path/puzzle/board";

describe("createHamiltonianPathProblemIdentity", () => {
  test("条件と候補番号を seed に含めた今の版の identity を作ること", () => {
    const identity = createHamiltonianPathProblemIdentity(8, 0.15, 3);

    expect(identity).toEqual({
      generatorVersion: HAMILTONIAN_PATH_GENERATOR_VERSION,
      seed: "hp-8-15-3",
      conditions: { size: 8, wallRatio: 0.15 },
    });
  });
});

describe("isHamiltonianPathProblemIdentity", () => {
  const identity = createHamiltonianPathProblemIdentity(6, 0, 1);
  const invalidValues: readonly [string, unknown][] = [
    ["オブジェクトでない値", "hp-6-0-1"],
    ["生成器の版が違う", { ...identity, generatorVersion: "0" }],
    ["seed が空", { ...identity, seed: "" }],
    [
      "扱わない盤面サイズ",
      { ...identity, conditions: { size: 10, wallRatio: 0 } },
    ],
    ["扱わない壁率", { ...identity, conditions: { size: 6, wallRatio: 0.3 } }],
    ["生成条件が無い", { ...identity, conditions: undefined }],
  ];

  test("今の生成器の identity を受け入れること", () => {
    const result = isHamiltonianPathProblemIdentity(identity);

    expect(result).toBe(true);
  });

  test.each(invalidValues)("%s値を拒否すること", (_, value) => {
    const result = isHamiltonianPathProblemIdentity(value);

    expect(result).toBe(false);
  });
});

describe("isHamiltonianPathRecordedProblemIdentity", () => {
  const otherVersionIdentity = {
    generatorVersion: "0",
    seed: "hp-old",
    conditions: { size: 12 },
  };
  const brokenCurrentIdentity = {
    ...createHamiltonianPathProblemIdentity(6, 0, 1),
    conditions: { size: 12, wallRatio: 0 },
  };

  test("生成器の版が違う記録の identity も読めること", () => {
    const result =
      isHamiltonianPathRecordedProblemIdentity(otherVersionIdentity);

    expect(result).toBe(true);
  });

  test("今の版で生成条件が扱えない identity を拒否すること", () => {
    const result = isHamiltonianPathRecordedProblemIdentity(
      brokenCurrentIdentity,
    );

    expect(result).toBe(false);
  });
});

describe("assertHamiltonianPathProblem", () => {
  const problem: HamiltonianPathProblem = parseHamiltonianPathBoard([
    "S .|.",
    "",
    ". # .",
    "",
    ". . .",
  ]);
  const separatedProblem: HamiltonianPathProblem = parseHamiltonianPathBoard([
    "S . #",
    "",
    ". # .",
    "    -",
    "# . .",
  ]);

  test("有効マスがつながった問題を受け入れること", () => {
    const act = () => assertHamiltonianPathProblem(problem);

    expect(act).not.toThrow();
  });

  test("有効マスが切り離された問題を拒否すること", () => {
    const act = () => assertHamiltonianPathProblem(separatedProblem);

    expect(act).toThrow();
  });
});

describe("countHamiltonianPathOpenCells", () => {
  const cases = [
    [{ size: 8, wallRatio: 0 }, 64],
    [{ size: 7, wallRatio: 0.15 }, 42],
    [{ size: 5, wallRatio: 0.15 }, 21],
  ] as const;

  test.each(cases)(
    "盤面のマスから壁率の分を除いた数にすること: %o",
    (conditions, expected) => {
      const openCellCount = countHamiltonianPathOpenCells(conditions);

      expect(openCellCount).toBe(expected);
    },
  );
});

describe("isHamiltonianPathSolveWorkload", () => {
  const workload: HamiltonianPathSolveWorkload = {
    openCellCount: 64,
    assumptionCount: 8,
    refutationStepCount: 71,
    longestRefutationLength: 18,
    fatalBranchCount: 13,
  };
  const invalidValues: readonly [string, unknown][] = [
    ["オブジェクトでない値", 64],
    ["道が通るマスが無い", { ...workload, openCellCount: 0 }],
    ["仮置きの回数が整数でない", { ...workload, assumptionCount: 1.5 }],
    ["先読みの手数の合計が負の", { ...workload, refutationStepCount: -1 }],
    [
      "最も長い先読みが先読みの手数の合計を超える",
      { ...workload, longestRefutationLength: 72 },
    ],
    ["迷う分岐の数が無い", { ...workload, fatalBranchCount: undefined }],
  ];

  test("作業の量を受け入れること", () => {
    const result = isHamiltonianPathSolveWorkload(workload);

    expect(result).toBe(true);
  });

  test.each(invalidValues)("%s値を拒否すること", (_, value) => {
    const result = isHamiltonianPathSolveWorkload(value);

    expect(result).toBe(false);
  });
});

describe("isHamiltonianPathWorkloadOfIdentity", () => {
  const identity = createHamiltonianPathProblemIdentity(7, 0.15, 2);
  const workload: HamiltonianPathSolveWorkload = {
    openCellCount: 42,
    assumptionCount: 1,
    refutationStepCount: 6,
    longestRefutationLength: 6,
    fatalBranchCount: 7,
  };
  const mismatched = { ...workload, openCellCount: 49 };

  test("生成条件の盤面で道が通るマスの数と合う作業の量を受け入れること", () => {
    const result = isHamiltonianPathWorkloadOfIdentity(workload, identity);

    expect(result).toBe(true);
  });

  test("道が通るマスの数が生成条件と食い違う作業の量を拒否すること", () => {
    const result = isHamiltonianPathWorkloadOfIdentity(mismatched, identity);

    expect(result).toBe(false);
  });
});
