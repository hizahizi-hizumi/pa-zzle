import {
  countHamiltonianPathSolutions,
  isHamiltonianPathUniquelySolvable,
} from "@/games/hamiltonian-path/problem/generation/solver";
import {
  createHamiltonianPathAdjacency,
  type HamiltonianPathBoard,
  listHamiltonianPathCells,
  listHamiltonianPathOpenCells,
  parseHamiltonianPathBoard,
} from "@/games/hamiltonian-path/puzzle/board";
import { isHamiltonianPathSolved } from "@/games/hamiltonian-path/puzzle/rules";
import { createProblemSeededRandom } from "@/games/problem-seed";

function createOpenBoard(size: number, start: number): HamiltonianPathBoard {
  return { size, holes: [], start };
}

/** 4×4 か 5×5 に、穴と始点を無作為に置いた盤面。穴でないマスがつながらない盤面・解の無い盤面も含む。 */
function createRandomBoard(seed: string): HamiltonianPathBoard {
  const random = createProblemSeededRandom(seed);
  const size = random() < 0.5 ? 4 : 5;
  const cells = listHamiltonianPathCells(size);
  const holes = cells.filter(() => random() < 0.15);
  const openCells = cells.filter((cell) => !holes.includes(cell));
  return {
    size,
    holes,
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
 * 研究用 Python（`scripts/research/hamiltonian_path_experiment.py`）の `PathCounter.count` が、穴だけの盤面に返した結果。
 * 解の数・探索の節点の数・最初の解が一致することで移植を確かめる。
 * 一意解の盤面は TypeScript の生成器で作った問題を同型の正規化キーの向きで書き、2解目まで（20,000節点まで）探した。
 */
const pythonUniqueFixtures = [
  {
    name: "5×5・穴5",
    rows: ["# # . . .", ". . # . .", ". . . . .", ". . . . .", "# S . . #"],
    solution: [
      21, 16, 15, 10, 5, 6, 11, 12, 17, 22, 23, 18, 19, 14, 13, 8, 9, 4, 3, 2,
    ],
    searchStepCount: 22,
  },
  {
    name: "6×6・穴3",
    rows: [
      "# . # . . .",
      ". . . . . .",
      ". . . . . .",
      ". . S . . .",
      ". . . # . .",
      ". . . . . .",
    ],
    solution: [
      20, 21, 15, 14, 8, 9, 3, 4, 5, 11, 10, 16, 17, 23, 22, 28, 29, 35, 34, 33,
      32, 26, 25, 31, 30, 24, 18, 19, 13, 12, 6, 7, 1,
    ],
    searchStepCount: 259,
  },
  {
    name: "7×7・穴8",
    rows: [
      "# . . . # . .",
      ". . # S . . #",
      ". . . . . . .",
      ". . . . # . .",
      "# . . # # . .",
      ". . . . . . .",
      ". . . . . . .",
    ],
    solution: [
      10, 3, 2, 1, 8, 7, 14, 21, 22, 15, 16, 17, 24, 23, 30, 29, 36, 35, 42, 43,
      44, 37, 38, 45, 46, 39, 40, 47, 48, 41, 34, 33, 26, 27, 20, 19, 18, 11,
      12, 5, 6,
    ],
    searchStepCount: 44,
  },
  {
    name: "7×7・穴6",
    rows: [
      "# # . . . . .",
      ". . . . . . .",
      ". . . . . . .",
      ". . . . S . #",
      ". . . . . . #",
      ". . . . . . .",
      "# . . . . . #",
    ],
    solution: [
      25, 18, 17, 10, 9, 2, 3, 4, 11, 12, 5, 6, 13, 20, 19, 26, 33, 32, 39, 38,
      37, 30, 31, 24, 23, 16, 15, 8, 7, 14, 21, 22, 29, 28, 35, 36, 43, 44, 45,
      46, 47, 40, 41,
    ],
    searchStepCount: 2135,
  },
  {
    name: "8×8・穴7",
    rows: [
      ". # . . . . . .",
      ". . . . . . # .",
      "# # . . . . # .",
      ". . . . . . . .",
      ". . . . . # . .",
      ". . . . . . . #",
      ". . . . . . . .",
      ". . . S . . . .",
    ],
    solution: [
      59, 60, 61, 62, 63, 55, 54, 46, 45, 53, 52, 51, 50, 58, 57, 56, 48, 49,
      41, 40, 32, 24, 25, 33, 34, 42, 43, 44, 36, 35, 27, 26, 18, 19, 11, 12,
      13, 21, 20, 28, 29, 30, 38, 39, 31, 23, 15, 7, 6, 5, 4, 3, 2, 10, 9, 8, 0,
    ],
    searchStepCount: 5984,
  },
] as const;

/**
 * 研究用 Python の `PathCounter.count` が、解の多い穴だけの盤面に返した結果。
 * - `upTo64`: 64解まで（200,000節点まで）探したとき。
 * - `allSolutions`: 全解を数えたとき（6×6 以下だけ）。
 */
const pythonMultipleSolutionFixtures = [
  {
    name: "5×5・穴なし",
    rows: [". . . . .", ". . . . .", ". . S . .", ". . . . .", ". . . . ."],
    upTo64: { solutionCount: 64, searchStepCount: 753 },
    allSolutions: { solutionCount: 456, searchStepCount: 5273 },
  },
  {
    name: "5×5・穴4",
    rows: ["# # . . .", ". . . . .", ". . # S .", ". # . . .", ". . . . ."],
    upTo64: { solutionCount: 2, searchStepCount: 30 },
    allSolutions: { solutionCount: 2, searchStepCount: 30 },
  },
  {
    name: "6×6・穴なし",
    rows: [
      ". . . . . .",
      ". . . . . .",
      ". . . . . .",
      ". . . . . .",
      ". S . . . .",
      ". . . . . .",
    ],
    upTo64: { solutionCount: 64, searchStepCount: 533 },
    allSolutions: { solutionCount: 17496, searchStepCount: 189247 },
  },
  {
    name: "6×6・穴5",
    rows: [
      ". . . . . .",
      ". # # # . .",
      ". . . . . #",
      ". . . . . .",
      ". . . . . S",
      ". . . . . #",
    ],
    upTo64: { solutionCount: 64, searchStepCount: 541 },
    allSolutions: { solutionCount: 246, searchStepCount: 2779 },
  },
  {
    name: "7×7・穴なし",
    rows: [
      ". . . . . . .",
      ". . . . . . .",
      ". . . . . . .",
      ". . . . . . .",
      "S . . . . . .",
      ". . . . . . .",
      ". . . . . . .",
    ],
    upTo64: { solutionCount: 64, searchStepCount: 467 },
    allSolutions: null,
  },
  {
    name: "7×7・穴7",
    rows: [
      ". . . . # # #",
      ". # # . . . .",
      ". . . . . . .",
      "S . . . . . .",
      "# . . . . . .",
      ". . # . . . .",
      ". . . . . . .",
    ],
    upTo64: { solutionCount: 64, searchStepCount: 687 },
    allSolutions: null,
  },
  {
    name: "8×8・穴なし",
    rows: [
      ". . . . . . . .",
      ". . . . . . S .",
      ". . . . . . . .",
      ". . . . . . . .",
      ". . . . . . . .",
      ". . . . . . . .",
      ". . . . . . . .",
      ". . . . . . . .",
    ],
    upTo64: { solutionCount: 64, searchStepCount: 568 },
    allSolutions: null,
  },
  {
    name: "8×8・穴10",
    rows: [
      "# S . . . . . .",
      "# . . # . . . .",
      ". . . # . # . .",
      ". . . # . . . .",
      "# # . . . . . .",
      "# . . . . . . .",
      ". . . . # . . .",
      ". . . . . . . .",
    ],
    upTo64: { solutionCount: 64, searchStepCount: 764 },
    allSolutions: null,
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
    test.each(pythonUniqueFixtures)(
      "$name の一意解を同じ道・同じ節点の数で見つけること",
      ({ rows, solution, searchStepCount }) => {
        const result = countHamiltonianPathSolutions(
          parseHamiltonianPathBoard(rows),
          { solutionLimit: 2, searchStepLimit: 20_000 },
        );

        expect(result.status).toBe("complete");
        expect(result.solutionCount).toBe(1);
        expect(result.firstSolutions).toEqual([solution]);
        expect(result.searchStepCount).toBe(searchStepCount);
      },
    );

    test.each(pythonMultipleSolutionFixtures)(
      "$name の解を同じ数・同じ節点の数で数えること",
      ({ rows, upTo64, allSolutions }) => {
        const board = parseHamiltonianPathBoard(rows);

        const upTo64Result = countHamiltonianPathSolutions(board, {
          solutionLimit: 64,
          searchStepLimit: 200_000,
        });
        const allResult =
          allSolutions === null
            ? null
            : countHamiltonianPathSolutions(board, unlimited);

        expect(upTo64Result.solutionCount).toBe(upTo64.solutionCount);
        expect(upTo64Result.searchStepCount).toBe(upTo64.searchStepCount);
        expect(allResult?.solutionCount ?? null).toBe(
          allSolutions?.solutionCount ?? null,
        );
        expect(allResult?.searchStepCount ?? null).toBe(
          allSolutions?.searchStepCount ?? null,
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
  const uniqueBoard = parseHamiltonianPathBoard(pythonUniqueFixtures[0].rows);
  const ambiguousBoard = parseHamiltonianPathBoard(
    pythonMultipleSolutionFixtures[1].rows,
  );

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
