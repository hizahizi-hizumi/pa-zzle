import {
  createRandomMagicSquare,
  listAllMagicSquares4,
  pickMagicSquare4,
} from "@/games/magic-square/problem/generation/answers";
import reference from "@/games/magic-square/problem/generation/research-reference.json";
import {
  countMagicSquareSolutions,
  type MagicSquareGrid,
} from "@/games/magic-square/problem/generation/solver";
import { canonicalizeMagicSquareGrid } from "@/games/magic-square/problem/generation/symmetry";
import {
  getMagicSquareLineCellIndices,
  getMagicSquareMagicSum,
  listMagicSquareLines,
} from "@/games/magic-square/puzzle/board";
import { createProblemSeededRandom } from "@/games/problem-seed";

// 期待値は docs/パズル/導入調査/魔方陣/調査コード/magic_square_supply.expected.json の squares4 と、
// magic_square_difficulty.py の all_squares4 が空の盤面を数え上げたときの節点の数。

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

function countClasses(
  squares: readonly MagicSquareGrid[],
  group: "G" | "D4",
  complement: boolean,
): number {
  return new Set(
    squares.map((square) =>
      canonicalizeMagicSquareGrid(square, group, complement).join(","),
    ),
  ).size;
}

describe("listAllMagicSquares4", () => {
  const squares = listAllMagicSquares4();

  test("4×4 の魔方陣を重ねずに全部挙げること", () => {
    expect({
      total: squares.length,
      distinct: new Set(squares.map((square) => square.join(","))).size,
      magic: squares.every((square) => isMagicSquare(4, square)),
    }).toEqual({
      total: reference.squares4.total,
      distinct: reference.squares4.total,
      magic: true,
    });
  });

  test("回転・裏返しと、列の構造の自己同型と補数で、調査コードと同じ数の類に分かれること", () => {
    expect({
      d4: countClasses(squares, "D4", false),
      gWithComplement: countClasses(squares, "G", true),
    }).toEqual({
      d4: reference.squares4.classes_d4,
      gWithComplement: reference.squares4.classes_G_complement,
    });
  });

  test("数え上げで調べた節点の数が調査コードと同じこと", () => {
    const { nodes } = countMagicSquareSolutions(4, Array(16).fill(0), {
      limit: Number.POSITIVE_INFINITY,
      nodeCap: null,
    });

    expect(nodes).toBe(reference.squares4.enumerationNodes);
  });
});

describe("pickMagicSquare4", () => {
  test("同じ seed からは同じ魔方陣を、全部の魔方陣の中から選ぶこと", () => {
    const first = pickMagicSquare4(createProblemSeededRandom("magic-square"));
    const second = pickMagicSquare4(createProblemSeededRandom("magic-square"));

    expect({
      same: first === second,
      member: listAllMagicSquares4().includes(first),
    }).toEqual({ same: true, member: true });
  });
});

describe("createRandomMagicSquare", () => {
  test.each([5, 6])(
    "%i×%i の魔方陣を、同じ seed からは同じに作ること",
    (size) => {
      const first = createRandomMagicSquare(
        size,
        createProblemSeededRandom(`magic-square-${size}`),
      );
      const second = createRandomMagicSquare(
        size,
        createProblemSeededRandom(`magic-square-${size}`),
      );

      expect({
        magic: isMagicSquare(size, first.square),
        same: first.square.join(",") === second.square.join(","),
      }).toEqual({ magic: true, same: true });
    },
  );
});
