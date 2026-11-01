import {
  countHamiltonianPathSolutions,
  isHamiltonianPathUniquelySolvable,
} from "@/games/hamiltonian-path/problem/generation/solver";
import {
  createHamiltonianPathAdjacency,
  createHamiltonianPathPartition,
  type HamiltonianPathBoard,
  listHamiltonianPathCells,
  listHamiltonianPathGridNeighbors,
  listHamiltonianPathOpenCells,
  normalizeHamiltonianPathPartitions,
  parseHamiltonianPathBoard,
} from "@/games/hamiltonian-path/puzzle/board";
import { isHamiltonianPathSolved } from "@/games/hamiltonian-path/puzzle/rules";
import { createProblemSeededRandom } from "@/games/problem-seed";

function createOpenBoard(size: number, start: number): HamiltonianPathBoard {
  return { size, walls: [], partitions: [], start };
}

/** 4×4 か 5×5 に、壁マス・仕切り・始点を無作為に置いた盤面。有効マスがつながらない盤面・解の無い盤面も含む。 */
function createRandomBoard(seed: string): HamiltonianPathBoard {
  const random = createProblemSeededRandom(seed);
  const size = random() < 0.5 ? 4 : 5;
  const cells = listHamiltonianPathCells(size);
  const walls = cells.filter(() => random() < 0.06);
  const openCells = cells.filter((cell) => !walls.includes(cell));
  const partitions = openCells.flatMap((cell) =>
    listHamiltonianPathGridNeighbors(size, cell)
      .filter(
        (neighbor) =>
          neighbor > cell && openCells.includes(neighbor) && random() < 0.12,
      )
      .map((neighbor) => createHamiltonianPathPartition(cell, neighbor)),
  );
  return {
    size,
    walls,
    partitions: normalizeHamiltonianPathPartitions(partitions),
    start: openCells[Math.floor(random() * openCells.length)]!,
  };
}

/** 枝刈りをせずに、始点から全ての有効マスを1回ずつ通る道を数える。 */
function countPathsByBruteForce(board: HamiltonianPathBoard): number {
  const adjacency = createHamiltonianPathAdjacency(board);
  const openCellCount = listHamiltonianPathOpenCells(board).length;
  const visited = new Set([board.start]);
  function countFrom(head: number): number {
    if (visited.size === openCellCount) {
      return 1;
    }
    let count = 0;
    for (const next of adjacency[head]!) {
      if (!visited.has(next)) {
        visited.add(next);
        count += countFrom(next);
        visited.delete(next);
      }
    }
    return count;
  }
  return countFrom(board.start);
}

/**
 * 研究用 Python（`scripts/research/hamiltonian_path_experiment.py`）の `gen_thin` で作った一意解の盤面と、
 * 同じ Python の `PathCounter.count` が返した結果。解の数・探索の節点の数・最初の解が一致することで移植を確かめる。
 * - `uniqueSearchStepCount`: 仕切りありで2解目まで探したときの節点の数。
 * - `withoutPartitions`: 仕切りを外し、64解まで探したとき。
 * - `allSolutionsWithoutPartitions`: 仕切りを外して全解を数えたとき（6×6 以下だけ）。
 */
const pythonFixtures = [
  {
    name: "5×5・壁率0.0",
    rows: [
      ". . . . .",
      "    -    ",
      ". . .|. .",
      "        -",
      ".|. S .|.",
      "         ",
      ". . . . .",
      "    -    ",
      ". . . . .",
    ],
    solution: [
      12, 7, 6, 11, 16, 17, 18, 13, 8, 9, 4, 3, 2, 1, 0, 5, 10, 15, 20, 21, 22,
      23, 24, 19, 14,
    ],
    uniqueSearchStepCount: 24,
    withoutPartitions: { solutionCountUpTo64: 64, searchStepCount: 753 },
    allSolutionsWithoutPartitions: {
      solutionCount: 456,
      searchStepCount: 5273,
    },
  },
  {
    name: "5×5・壁率0.15",
    rows: [
      "# # . . .",
      "         ",
      ". . . . .",
      "         ",
      ".|. # S .",
      "         ",
      ". # . . .",
      "         ",
      ". . . . .",
    ],
    solution: [
      13, 8, 7, 2, 3, 4, 9, 14, 19, 24, 23, 18, 17, 22, 21, 20, 15, 10, 5, 6,
      11,
    ],
    uniqueSearchStepCount: 26,
    withoutPartitions: { solutionCountUpTo64: 2, searchStepCount: 30 },
    allSolutionsWithoutPartitions: { solutionCount: 2, searchStepCount: 30 },
  },
  {
    name: "6×6・壁率0.0",
    rows: [
      ". . . . . .",
      "           ",
      ". . . . . .",
      "      -    ",
      ". .|. . . .",
      "  -        ",
      ". . . .|. .",
      "    -     -",
      ". S .|. . .",
      "  -        ",
      ". .|. . . .",
    ],
    solution: [
      25, 26, 32, 33, 34, 35, 29, 28, 27, 21, 15, 16, 22, 23, 17, 11, 5, 4, 10,
      9, 3, 2, 1, 0, 6, 12, 13, 7, 8, 14, 20, 19, 18, 24, 30, 31,
    ],
    uniqueSearchStepCount: 39,
    withoutPartitions: { solutionCountUpTo64: 64, searchStepCount: 533 },
    allSolutionsWithoutPartitions: {
      solutionCount: 17496,
      searchStepCount: 189247,
    },
  },
  {
    name: "6×6・壁率0.15",
    rows: [
      ". . . . . .",
      "        -  ",
      ". # # # . .",
      "        -  ",
      ". . . . . #",
      "-          ",
      ". . . . . .",
      "           ",
      ". . . . . S",
      "  -        ",
      ". . . . . #",
    ],
    solution: [
      29, 23, 22, 16, 15, 21, 27, 28, 34, 33, 32, 31, 30, 24, 18, 19, 25, 26,
      20, 14, 13, 12, 6, 0, 1, 2, 3, 4, 5, 11, 10,
    ],
    uniqueSearchStepCount: 39,
    withoutPartitions: { solutionCountUpTo64: 64, searchStepCount: 541 },
    allSolutionsWithoutPartitions: {
      solutionCount: 246,
      searchStepCount: 2779,
    },
  },
  {
    name: "7×7・壁率0.0",
    rows: [
      ". . . . . . .",
      "      -      ",
      ". .|.|.|.|. .",
      "             ",
      ". .|.|. . . .",
      "             ",
      ". . . . . . .",
      "  -         -",
      "S . . . . . .",
      "    -        ",
      ". . . . . . .",
      "        -    ",
      ". . . . . . .",
    ],
    solution: [
      28, 21, 14, 7, 0, 1, 8, 15, 22, 23, 16, 9, 2, 3, 4, 11, 18, 19, 12, 5, 6,
      13, 20, 27, 26, 25, 32, 39, 40, 33, 34, 41, 48, 47, 46, 45, 38, 37, 44,
      43, 42, 35, 36, 29, 30, 31, 24, 17, 10,
    ],
    uniqueSearchStepCount: 348,
    withoutPartitions: { solutionCountUpTo64: 64, searchStepCount: 467 },
    allSolutionsWithoutPartitions: null,
  },
  {
    name: "7×7・壁率0.15",
    rows: [
      ". . . . # # #",
      "             ",
      ". # # . . . .",
      "          -  ",
      ". . . . . . .",
      "  - -     -  ",
      "S . .|.|. . .",
      "      -      ",
      "# . . . . . .",
      "            -",
      ". . # . . . .",
      "        -    ",
      ". . . . . . .",
    ],
    solution: [
      21, 22, 23, 30, 29, 36, 35, 42, 43, 44, 45, 46, 47, 48, 41, 40, 39, 38,
      31, 32, 33, 34, 27, 26, 25, 18, 19, 20, 13, 12, 11, 10, 3, 2, 1, 0, 7, 14,
      15, 16, 17, 24,
    ],
    uniqueSearchStepCount: 49,
    withoutPartitions: { solutionCountUpTo64: 64, searchStepCount: 687 },
    allSolutionsWithoutPartitions: null,
  },
  {
    name: "8×8・壁率0.0",
    rows: [
      ". . . . . . . .",
      "      - -   -  ",
      ". . . . .|. S .",
      "               ",
      ".|. . . . . . .",
      "      -       -",
      ". . .|.|. . . .",
      "  -            ",
      ".|. . . . . . .",
      "              -",
      ".|. .|. .|. . .",
      "      -        ",
      ". . . . . . . .",
      "            -  ",
      ". . . . . . . .",
    ],
    solution: [
      14, 13, 21, 22, 23, 15, 7, 6, 5, 4, 3, 2, 10, 11, 12, 20, 19, 18, 26, 25,
      17, 9, 1, 0, 8, 16, 24, 32, 40, 48, 56, 57, 49, 41, 33, 34, 42, 50, 58,
      59, 51, 52, 60, 61, 62, 63, 55, 47, 46, 54, 53, 45, 37, 38, 39, 31, 30,
      29, 28, 36, 44, 43, 35, 27,
    ],
    uniqueSearchStepCount: 894,
    withoutPartitions: { solutionCountUpTo64: 64, searchStepCount: 568 },
    allSolutionsWithoutPartitions: null,
  },
  {
    name: "8×8・壁率0.15",
    rows: [
      "# S . . . .|. .",
      "               ",
      "# . . # . . . .",
      "               ",
      ". . . # . # . .",
      "               ",
      ". . . # . . . .",
      "        -      ",
      "# # . . . . . .",
      "               ",
      "# . . . .|.|. .",
      "          -    ",
      ". . . . # . . .",
      "               ",
      ". . . . . . . .",
    ],
    solution: [
      1, 9, 17, 16, 24, 25, 26, 18, 10, 2, 3, 4, 5, 13, 12, 20, 28, 29, 30, 22,
      14, 6, 7, 15, 23, 31, 39, 38, 46, 47, 55, 63, 62, 54, 53, 61, 60, 59, 51,
      50, 58, 57, 56, 48, 49, 41, 42, 34, 35, 43, 44, 36, 37, 45,
    ],
    uniqueSearchStepCount: 201,
    withoutPartitions: { solutionCountUpTo64: 64, searchStepCount: 764 },
    allSolutionsWithoutPartitions: null,
  },
] as const;

describe("countHamiltonianPathSolutions", () => {
  const knownCornerPathCounts = [
    [4, 52, 369],
    [5, 824, 6553],
    [6, 22144, 213267],
  ] as const;
  const unlimited = {
    solutionLimit: Number.POSITIVE_INFINITY,
    searchStepLimit: Number.POSITIVE_INFINITY,
  };

  test.each(knownCornerPathCounts)(
    "%i×%i の全面盤の角から始まる道を既知の数 %i だけ、研究用 Python と同じ節点の数で数えること",
    (size, expectedCount, expectedSearchStepCount) => {
      const result = countHamiltonianPathSolutions(
        createOpenBoard(size, 0),
        unlimited,
      );

      expect(result.status).toBe("complete");
      expect(result.solutionCount).toBe(expectedCount);
      expect(result.searchStepCount).toBe(expectedSearchStepCount);
    },
  );

  describe("研究用 Python が出力した固定盤面の場合", () => {
    test.each(pythonFixtures)(
      "$name の一意解を同じ道・同じ節点の数で見つけること",
      ({ rows, solution, uniqueSearchStepCount }) => {
        const result = countHamiltonianPathSolutions(
          parseHamiltonianPathBoard(rows),
          { solutionLimit: 2, searchStepLimit: 20_000 },
        );

        expect(result.status).toBe("complete");
        expect(result.solutionCount).toBe(1);
        expect(result.firstSolutions).toEqual([solution]);
        expect(result.searchStepCount).toBe(uniqueSearchStepCount);
      },
    );

    test.each(pythonFixtures)(
      "$name から仕切りを外した盤面の解を同じ数・同じ節点の数で数えること",
      ({ rows, withoutPartitions, allSolutionsWithoutPartitions }) => {
        const board = { ...parseHamiltonianPathBoard(rows), partitions: [] };

        const upTo64 = countHamiltonianPathSolutions(board, {
          solutionLimit: 64,
          searchStepLimit: 200_000,
        });
        const all =
          allSolutionsWithoutPartitions === null
            ? null
            : countHamiltonianPathSolutions(board, unlimited);

        expect(upTo64.solutionCount).toBe(
          withoutPartitions.solutionCountUpTo64,
        );
        expect(upTo64.searchStepCount).toBe(withoutPartitions.searchStepCount);
        expect(all?.solutionCount ?? null).toBe(
          allSolutionsWithoutPartitions?.solutionCount ?? null,
        );
        expect(all?.searchStepCount ?? null).toBe(
          allSolutionsWithoutPartitions?.searchStepCount ?? null,
        );
      },
    );
  });

  describe("小さな無作為盤面の場合", () => {
    const cases = Array.from({ length: 60 }, (_, index) => {
      const board = createRandomBoard(`solver-property-${index}`);
      return [index, board, countPathsByBruteForce(board)] as const;
    });

    test.each(cases)(
      "盤面 %i の解を、枝刈りをしない総当たりと同じ数だけ数え、見つけた解が全マスを通る道であること",
      (_, board, expectedCount) => {
        const result = countHamiltonianPathSolutions(board, unlimited);
        const solved = result.firstSolutions.map((solution) =>
          isHamiltonianPathSolved(board, solution),
        );

        expect(result.status).toBe("complete");
        expect(result.solutionCount).toBe(expectedCount);
        expect(solved).not.toContain(false);
      },
    );
  });

  describe("始点の色が多い側でない盤面の場合", () => {
    const board = createOpenBoard(3, 1);

    test("解が無いと数えること", () => {
      const result = countHamiltonianPathSolutions(board);

      expect(result).toEqual({
        status: "complete",
        solutionCount: 0,
        firstSolutions: [],
        searchStepCount: 1,
      });
    });
  });

  describe("探索量の上限に達した場合", () => {
    const board = createOpenBoard(6, 0);
    const options = { solutionLimit: 100, searchStepLimit: 10 };

    test("打ち切ったことと、そこまでの節点の数を返すこと", () => {
      const result = countHamiltonianPathSolutions(board, options);

      expect(result.status).toBe("search-limit-reached");
      expect(result.searchStepCount).toBe(11);
    });
  });
});

describe("isHamiltonianPathUniquelySolvable", () => {
  const uniqueBoard = parseHamiltonianPathBoard(pythonFixtures[0].rows);
  const ambiguousBoard = { ...uniqueBoard, partitions: [] };

  test("解がただ1つの盤面を一意とすること", () => {
    const unique = isHamiltonianPathUniquelySolvable(uniqueBoard);

    expect(unique).toBe(true);
  });

  test("別解のある盤面を一意としないこと", () => {
    const unique = isHamiltonianPathUniquelySolvable(ambiguousBoard);

    expect(unique).toBe(false);
  });

  test("探索量の上限までに確かめ切れない盤面を一意としないこと", () => {
    const unique = isHamiltonianPathUniquelySolvable(uniqueBoard, 1);

    expect(unique).toBe(false);
  });
});
