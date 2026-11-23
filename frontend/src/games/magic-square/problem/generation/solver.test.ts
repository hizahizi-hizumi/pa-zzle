import reference from "@/games/magic-square/problem/generation/research-reference.json";
import {
  countMagicSquareSolutions,
  type MagicSquareGrid,
} from "@/games/magic-square/problem/generation/solver";
import {
  getMagicSquareLineCellIndices,
  getMagicSquareMagicSum,
  listMagicSquareLines,
} from "@/games/magic-square/puzzle/board";

// 期待値は docs/パズル/導入調査/魔方陣/調査コード/magic_square_difficulty.py の count_solutions で数えた値。
// 節点の数まで合わせるのは、節点の上限で打ち切るかが問題の採否を変えるため（難易度の資料 §2.6）。

function isMagicSquare(size: number, grid: MagicSquareGrid): boolean {
  const values = [...grid].toSorted((left, right) => left - right);
  return (
    values.every((value, index) => value === index + 1) &&
    listMagicSquareLines(size).every(
      (line) =>
        getMagicSquareLineCellIndices(size, line).reduce(
          (sum, cellIndex) => sum + grid[cellIndex]!,
          0,
        ) === getMagicSquareMagicSum(size),
    )
  );
}

describe("countMagicSquareSolutions", () => {
  test.each(reference.solver.map((entry) => [entry.id, entry] as const))(
    "%s の解の数と調べた節点の数が調査コードと同じこと",
    (_, entry) => {
      const { count, nodes, capped } = countMagicSquareSolutions(
        entry.n,
        entry.givens,
        { limit: entry.limit, nodeCap: entry.nodeCap },
      );

      expect({ count, nodes, capped }).toEqual({
        count: entry.count,
        nodes: entry.nodes,
        capped: entry.capped,
      });
    },
  );

  test("既定では、2つ目の解を見つけたところで止めること", () => {
    const ambiguous = reference.solver.find(({ id }) =>
      id.endsWith("-ambiguous"),
    );
    const result = countMagicSquareSolutions(
      ambiguous?.n ?? 4,
      ambiguous?.givens ?? [],
    );

    expect({ count: result.count, nodes: result.nodes }).toEqual({
      count: 2,
      nodes: ambiguous?.nodes,
    });
  });

  test.each(reference.cases.map((entry) => [entry.id, entry] as const))(
    "%s の解を返すと、答えの魔方陣になること",
    (_, entry) => {
      const { solutions } = countMagicSquareSolutions(entry.n, entry.givens, {
        collect: true,
      });

      expect({
        solutions,
        magic: solutions.every((solution) => isMagicSquare(entry.n, solution)),
      }).toEqual({ solutions: [entry.solution], magic: true });
    },
  );
});
