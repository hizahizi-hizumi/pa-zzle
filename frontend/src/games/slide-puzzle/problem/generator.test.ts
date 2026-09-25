// @vitest-environment node

import {
  generateSlidePuzzleBoard,
  restoreSlidePuzzleProblem,
} from "@/games/slide-puzzle/problem/generator";
import type { SlidePuzzleProblemIdentity } from "@/games/slide-puzzle/problem/problem";
import { isSolvableSlidePuzzleBoard } from "@/games/slide-puzzle/puzzle/rules";
import { calculateSlidePuzzleManhattanDistance } from "@/games/slide-puzzle/puzzle/state";

describe("generateSlidePuzzleBoard", () => {
  const conditions = { size: 4, scrambleLength: 40 } as const;

  test("同じ seed と条件から同じ盤面を返すこと", () => {
    const first = generateSlidePuzzleBoard("same-seed", conditions);
    const second = generateSlidePuzzleBoard("same-seed", conditions);

    expect(second).toEqual(first);
  });

  test("seed が違えば別の盤面を返すこと", () => {
    const first = generateSlidePuzzleBoard("seed-a", conditions);
    const second = generateSlidePuzzleBoard("seed-b", conditions);

    expect(second).not.toEqual(first);
  });

  const solvableCases = [
    ["seed-1", 15],
    ["seed-2", 35],
    ["seed-3", 60],
    ["seed-4", 150],
    ["seed-5", 301],
  ] as const;

  test.each(solvableCases)(
    "生成した盤面は完成盤面へ到達できること: %s を %i 手撹拌",
    (seed, scrambleLength) => {
      const result = generateSlidePuzzleBoard(seed, {
        size: 4,
        scrambleLength,
      });

      expect(isSolvableSlidePuzzleBoard(result)).toBe(true);
    },
  );

  test("1 手だけ撹拌すると完成盤面から 1 枚だけずれた盤面を返すこと", () => {
    const result = generateSlidePuzzleBoard("one-step", {
      size: 4,
      scrambleLength: 1,
    });

    expect(calculateSlidePuzzleManhattanDistance(result)).toBe(1);
  });

  const invalidConditions = [
    ["撹拌手数が 0", { size: 4, scrambleLength: 0 }],
    ["撹拌手数が整数ではない", { size: 4, scrambleLength: 1.5 }],
    ["盤面サイズが 4 ではない", { size: 3, scrambleLength: 10 }],
  ] as const;

  test.each(invalidConditions)(
    "不正な生成条件を拒否すること: %s",
    (_, target) => {
      const act = () =>
        generateSlidePuzzleBoard(
          "invalid",
          target as unknown as typeof conditions,
        );

      expect(act).toThrow();
    },
  );
});

describe("restoreSlidePuzzleProblem", () => {
  const identity: SlidePuzzleProblemIdentity = {
    generatorVersion: "1",
    seed: "restore-seed",
    conditions: { size: 4, scrambleLength: 25 },
  };
  const unsupportedIdentity = {
    ...identity,
    generatorVersion: "0",
  } as unknown as SlidePuzzleProblemIdentity;

  test("識別情報から同じ初期盤面を再現すること", () => {
    const result = restoreSlidePuzzleProblem(identity);

    expect(result).toEqual({
      problem: {
        initialBoard: generateSlidePuzzleBoard(
          identity.seed,
          identity.conditions,
        ),
      },
      identity,
    });
  });

  test("未対応の生成器の版を拒否すること", () => {
    const act = () => restoreSlidePuzzleProblem(unsupportedIdentity);

    expect(act).toThrow();
  });
});
