import {
  assertHamiltonianPathProblem,
  createHamiltonianPathProblemIdentity,
  HAMILTONIAN_PATH_GENERATOR_VERSION,
  type HamiltonianPathProblem,
  isHamiltonianPathProblemIdentity,
  isHamiltonianPathRecordedProblemIdentity,
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
