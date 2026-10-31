import {
  getIceFloorMazeSymmetryKey,
  listIceFloorMazeSymmetries,
} from "@/games/ice-floor-maze/problem/generation/symmetry";
import type { IceFloorMazeProblem } from "@/games/ice-floor-maze/problem/problem";
import { parseIceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";

describe("listIceFloorMazeSymmetries", () => {
  describe("正方形の盤面の場合", () => {
    // #  1  2
    // 3  4  5
    // 6  7  8
    const problem: IceFloorMazeProblem = {
      board: parseIceFloorMazeBoard(["#..", "...", "..."]),
      start: 1,
      goal: 5,
    };

    test("回転・反転の8通りを、先頭を元の問題として返すこと", () => {
      const symmetries = listIceFloorMazeSymmetries(problem);

      expect(symmetries).toHaveLength(8);
      expect(symmetries[0]).toEqual(problem);
    });

    test("岩・開始位置・ゴールを同じ変換で移し、8通りがすべて異なること", () => {
      const symmetries = listIceFloorMazeSymmetries(problem);

      const placements = symmetries.map(({ board, start, goal }) => ({
        rock: board.cells.indexOf("rock"),
        start,
        goal,
      }));

      expect(
        new Set(placements.map((placement) => JSON.stringify(placement))).size,
      ).toBe(8);
      expect(placements).toContainEqual({ rock: 2, start: 5, goal: 7 });
      expect(placements).toContainEqual({ rock: 6, start: 3, goal: 1 });
    });
  });

  describe("縦長の盤面の場合", () => {
    // #  1  2
    // 3  4  5
    // 6  7  8
    // 9  10 11
    const problem: IceFloorMazeProblem = {
      board: parseIceFloorMazeBoard(["#..", "...", "...", "..."]),
      start: 1,
      goal: 5,
    };

    test("形を保つ恒等・左右反転・上下反転・180度回転の4通りだけを返すこと", () => {
      const symmetries = listIceFloorMazeSymmetries(problem);

      const placements = symmetries.map(({ board, start, goal }) => ({
        width: board.width,
        height: board.height,
        rock: board.cells.indexOf("rock"),
        start,
        goal,
      }));

      expect(placements).toEqual([
        { width: 3, height: 4, rock: 0, start: 1, goal: 5 },
        { width: 3, height: 4, rock: 2, start: 1, goal: 3 },
        { width: 3, height: 4, rock: 9, start: 10, goal: 8 },
        { width: 3, height: 4, rock: 11, start: 10, goal: 6 },
      ]);
    });
  });
});

describe("getIceFloorMazeSymmetryKey", () => {
  describe("研究用 Python の固定盤面の場合", () => {
    // scripts/research/ice_floor_supply_experiment.py の random_board_candidates で作った盤面と開始位置に、
    // 最も遠い停止点をゴールにした問題。期待値は canonical_key の (盤面, 開始位置, ゴール) を、
    // 形・盤面・3桁の開始位置・3桁のゴールの順に `:` でつないだもの。
    const researchCases = [
      {
        name: "8×8",
        problem: {
          board: parseIceFloorMazeBoard([
            "#...#.#.",
            "........",
            ".....#..",
            "........",
            ".......#",
            "..#.#...",
            "#.##.#..",
            "..#.....",
          ]),
          start: 12,
          goal: 29,
        },
        expectedKey:
          "8x8:#...#.#..............#.................#..#.#...#.##.#....#.....:012:029",
      },
      {
        name: "9×12",
        problem: {
          board: parseIceFloorMazeBoard([
            ".#......#",
            "....#.##.",
            ".#......#",
            "...#...##",
            ".........",
            "#.##...#.",
            "..##...#.",
            "...##..#.",
            ".........",
            "#...###..",
            "....#....",
            ".#..#....",
          ]),
          start: 31,
          goal: 63,
        },
        expectedKey:
          "9x12:#......#..##.#....#......#.##...#.............#...##.#.#...##...#..##..............###...#....#........#..#.:031:071",
      },
    ];

    test.each(researchCases)(
      "$name の正規化キーが Python の canonical_key と一致すること",
      ({ problem, expectedKey }) => {
        const key = getIceFloorMazeSymmetryKey(problem);

        expect(key).toBe(expectedKey);
      },
    );

    test.each(researchCases)(
      "$name を回転・反転したどの問題も同じ正規化キーになること",
      ({ problem, expectedKey }) => {
        const keys = listIceFloorMazeSymmetries(problem).map(
          getIceFloorMazeSymmetryKey,
        );

        expect(new Set(keys)).toEqual(new Set([expectedKey]));
      },
    );
  });

  describe("同型でない問題の場合", () => {
    const board = parseIceFloorMazeBoard(["#..", "...", "..."]);
    const problem: IceFloorMazeProblem = { board, start: 1, goal: 5 };
    const otherGoal: IceFloorMazeProblem = { board, start: 1, goal: 8 };

    test("ゴールが違えば別の正規化キーになること", () => {
      const key = getIceFloorMazeSymmetryKey(problem);
      const otherKey = getIceFloorMazeSymmetryKey(otherGoal);

      expect(otherKey).not.toBe(key);
    });
  });
});
