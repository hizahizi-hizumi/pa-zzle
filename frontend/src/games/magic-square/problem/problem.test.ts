import {
  _private,
  assertMagicSquareProblem,
  createMagicSquareSolveWorkload,
  isCurrentMagicSquareProblemIdentity,
  isMagicSquareRecordedProblemIdentity,
  isMagicSquareSolveWorkload,
  MAGIC_SQUARE_GENERATOR_VERSION,
  type MagicSquareProblem,
  type MagicSquareProblemIdentity,
  restoreMagicSquareProblem,
  summarizeMagicSquareSeed,
} from "@/games/magic-square/problem/problem";
import { parseMagicSquareBoard } from "@/games/magic-square/puzzle/board";

const { createMagicSquareProblemIdentity, decodeMagicSquareProblem } = _private;

const problem: MagicSquareProblem = {
  givens: parseMagicSquareBoard([". 4 5 .", ". 2 . .", ". . 12 1", "3 . 10 6"]),
};
const seed = "0.4.5.0.0.2.0.0.0.0.12.1.3.0.10.6";

describe("assertMagicSquareProblem", () => {
  test("最初から置いてある数で違反の無い問題を受け付けること", () => {
    const act = () => assertMagicSquareProblem(problem);

    expect(act).not.toThrow();
  });

  const invalidCases = [
    ["出さない一辺の盤面", ["2 7 6", "9 . 1", "4 3 8"]],
    ["空きの無い盤面", ["14 4 5 11", "9 2 7 16", "8 13 12 1", "3 15 10 6"]],
    [
      "最初から置いてある数だけで合計に届いた列がある盤面",
      ["16 15 3 .", ". . . .", ". . . .", ". . . ."],
    ],
    [
      "最初から置いてある数だけで埋まって合わない列がある盤面",
      ["1 2 3 4", ". . . .", ". . . .", ". . . ."],
    ],
  ] as const;

  test.each(invalidCases)("%sを受け付けないこと", (_, rows) => {
    const act = () =>
      assertMagicSquareProblem({ givens: parseMagicSquareBoard(rows) });

    expect(act).toThrow(RangeError);
  });
});

describe("createMagicSquareProblemIdentity", () => {
  test("最初から置いてある数を行優先で . でつなぎ、空きを 0 にした seed を作ること", () => {
    const identity = createMagicSquareProblemIdentity(problem);

    expect(identity).toEqual({
      generatorVersion: MAGIC_SQUARE_GENERATOR_VERSION,
      seed,
      conditions: { size: 4 },
    });
  });
});

describe("restoreMagicSquareProblem", () => {
  const identity = createMagicSquareProblemIdentity(problem);
  const otherVersionIdentity = {
    ...identity,
    generatorVersion: "0",
  } as unknown as MagicSquareProblemIdentity;
  const invalidSeedIdentity = { ...identity, seed: "0.4.5" };

  test("seed から同じ問題を復号すること", () => {
    const restored = restoreMagicSquareProblem(identity);

    expect(restored).toEqual({ problem, identity });
  });

  test("今と違う版の identity を復元しないこと", () => {
    const act = () => restoreMagicSquareProblem(otherVersionIdentity);

    expect(act).toThrow();
  });

  test("盤面の大きさと合わない seed を復元しないこと", () => {
    const act = () => restoreMagicSquareProblem(invalidSeedIdentity);

    expect(act).toThrow(RangeError);
  });
});

describe("decodeMagicSquareProblem", () => {
  const cases = [
    ["マスの数が一辺の2乗と違う", "1.2.3", 4],
    ["範囲外の数を含む", "0.4.5.0.0.2.0.0.0.0.12.1.3.0.10.17", 4],
    ["同じ数を2回含む", "0.4.5.0.0.2.0.0.0.0.12.1.3.0.10.4", 4],
    ["数でない記法を含む", "0.4.5.x.0.2.0.0.0.0.12.1.3.0.10.6", 4],
    ["0 で始まる2桁を含む", "0.04.5.0.0.2.0.0.0.0.12.1.3.0.10.6", 4],
  ] as const;

  test.each(cases)("%s seed には null を返すこと", (_, encoded, size) => {
    const decoded = decodeMagicSquareProblem(encoded, size);

    expect(decoded).toBeNull();
  });
});

describe("isCurrentMagicSquareProblemIdentity", () => {
  const identity = createMagicSquareProblemIdentity(problem);
  const cases = [
    ["今の版で復号できる identity", identity, true],
    ["今と違う版の identity", { ...identity, generatorVersion: "0" }, false],
    [
      "出さない一辺の identity",
      { ...identity, conditions: { size: 3 } },
      false,
    ],
    ["復号できない seed の identity", { ...identity, seed: "1.2" }, false],
    [
      "空きの無い seed の identity",
      { ...identity, seed: "14.4.5.11.9.2.7.16.8.13.12.1.3.15.10.6" },
      false,
    ],
    [
      "最初から置いてある数だけで違反の列がある seed の identity",
      { ...identity, seed: "1.2.3.4.0.0.0.0.0.0.0.0.0.0.0.0" },
      false,
    ],
    ["オブジェクトでない値", "magic-square", false],
  ] as const;

  test.each(cases)("%sを見分けること", (_, value, expected) => {
    const current = isCurrentMagicSquareProblemIdentity(value);

    expect(current).toBe(expected);
  });
});

describe("summarizeMagicSquareSeed", () => {
  test("seed から盤面の一辺と最初から置いてある数の個数を読むこと", () => {
    const summary = summarizeMagicSquareSeed(seed);

    expect(summary).toEqual({ size: 4, givenCount: 8 });
  });
});

describe("isMagicSquareRecordedProblemIdentity", () => {
  const identity = createMagicSquareProblemIdentity(problem);
  const cases = [
    ["今の版の identity", identity, true],
    [
      "seed のある別の版の identity",
      { generatorVersion: "0", seed: "old", conditions: {} },
      true,
    ],
    ["今の版で復号できない identity", { ...identity, seed: "1.2" }, false],
    ["seed の無い identity", { generatorVersion: "0", conditions: {} }, false],
  ] as const;

  test.each(cases)("記録の%sを読めるかを返すこと", (_, value, expected) => {
    const readable = isMagicSquareRecordedProblemIdentity(value);

    expect(readable).toBe(expected);
  });
});

describe("createMagicSquareSolveWorkload", () => {
  test("空きマスの数を数えること", () => {
    const workload = createMagicSquareSolveWorkload(problem);

    expect(workload).toEqual({ emptyCellCount: 8 });
  });
});

describe("isMagicSquareSolveWorkload", () => {
  const cases = [
    [{ emptyCellCount: 8 }, true],
    [{ emptyCellCount: -1 }, false],
    [{ emptyCellCount: 1.5 }, false],
    [{}, false],
  ] as const;

  test.each(cases)("%o を作業の量かで分けること", (value, expected) => {
    const valid = isMagicSquareSolveWorkload(value);

    expect(valid).toBe(expected);
  });
});
