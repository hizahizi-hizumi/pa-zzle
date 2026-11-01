import {
  _private,
  createRandomSelfAvoidingWalk,
} from "@/games/hitofude-puzzle/problem/generation/self-avoiding-walk";
import { areHitofudePuzzleCellsAdjacent } from "@/games/hitofude-puzzle/puzzle/board";
import { createProblemSeededRandom } from "@/games/problem-seed";

const { createSerpentinePath, mutatePath } = _private;

function isSelfAvoidingWalk(size: number, path: readonly number[]): boolean {
  return (
    new Set(path).size === path.length &&
    path.every(
      (cell, index) =>
        index === 0 ||
        areHitofudePuzzleCellsAdjacent(size, path[index - 1]!, cell),
    )
  );
}

describe("createSerpentinePath", () => {
  test("行ごとに向きを変えて全マスを通ること", () => {
    const path = createSerpentinePath(3);

    expect(path).toEqual([0, 1, 2, 5, 4, 3, 6, 7, 8]);
  });
});

describe("mutatePath", () => {
  // 3×3 で 0-1-2-5-4 の道。末端 4 の隣は 1・5・7・3。
  const path = [0, 1, 2, 5, 4];
  const gridNeighbors = [
    [1, 3],
    [0, 2, 4],
    [1, 5],
    [0, 4, 6],
    [1, 5, 7, 3],
  ];

  function sequence(values: readonly number[]) {
    let index = 0;
    return () => values[index++]!;
  }

  const cases = [
    [
      "道の上の隣へつなぎ替え、その先を逆順にする",
      [0.9, 0],
      true,
      [0, 1, 4, 5, 2],
    ],
    ["直前のマスは変えない", [0.9, 0.3], true, [0, 1, 2, 5, 4]],
    ["道の外の隣へ伸ばして反対の端を縮める", [0.9, 0.6], true, [1, 2, 5, 4, 7]],
    [
      "reptation を許さなければ道の外の隣では変えない",
      [0.9, 0.6],
      false,
      [0, 1, 2, 5, 4],
    ],
    ["反対の端から変形する", [0.1, 0.9], true, [5, 2, 1, 0, 3]],
  ] as const;

  test.each(cases)("%sこと", (_, randomValues, allowsReptation, expected) => {
    const mutated = mutatePath(
      path,
      gridNeighbors,
      sequence(randomValues),
      allowsReptation,
    );

    expect(mutated).toEqual(expected);
  });
});

describe("createRandomSelfAvoidingWalk", () => {
  const cases = [
    [5, 25],
    [6, 31],
    [8, 54],
  ] as const;

  test.each(cases)(
    "一辺 %i の盤面で %i マスを1回ずつ通る道を作ること",
    (size, openCellCount) => {
      const path = createRandomSelfAvoidingWalk(
        size,
        openCellCount,
        createProblemSeededRandom(`walk-${size}`),
      );

      expect(path).toHaveLength(openCellCount);
      expect(isSelfAvoidingWalk(size, path)).toBe(true);
    },
  );

  test("同じ乱数列から同じ道を作ること", () => {
    const first = createRandomSelfAvoidingWalk(
      6,
      31,
      createProblemSeededRandom("same"),
    );
    const second = createRandomSelfAvoidingWalk(
      6,
      31,
      createProblemSeededRandom("same"),
    );

    expect(second).toEqual(first);
  });
});
