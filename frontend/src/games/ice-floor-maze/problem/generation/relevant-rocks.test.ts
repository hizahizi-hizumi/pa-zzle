import {
  listIceFloorMazeRelevantRocks,
  removeIceFloorMazeIrrelevantRocks,
} from "@/games/ice-floor-maze/problem/generation/relevant-rocks";
import { parseIceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import { exploreIceFloorMazeStops } from "@/games/ice-floor-maze/puzzle/stop-graph";

describe("listIceFloorMazeRelevantRocks", () => {
  // 0  1  2  #
  // 4  #  6  7
  // 8  #  10 11
  // 12 13 14 15
  // 開始位置 0 からは 3 と 5 の岩が滑りを止めるか塞ぐ。9 の岩は、どの停止点からの滑りも隣で止まらない。
  const board = parseIceFloorMazeBoard(["...#", ".#..", ".#..", "...."]);
  const graph = exploreIceFloorMazeStops(board, 0);

  test("到達できる停止点の滑りを止めるか塞ぐ岩だけを返すこと", () => {
    const rocks = listIceFloorMazeRelevantRocks(board, graph);

    expect(rocks).toEqual([3, 5]);
  });
});

describe("removeIceFloorMazeIrrelevantRocks", () => {
  // scripts/research/ice_floor_supply_experiment.py の random_board_candidates で作った盤面と開始位置。
  // 期待値は relevant_rocks と without_irrelevant_rocks。
  const researchCases = [
    {
      name: "8×8",
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
      expectedRelevantRocks: [0, 4, 6, 21, 39, 42, 44, 48, 51, 53, 58],
      expectedBoard: parseIceFloorMazeBoard([
        "#...#.#.",
        "........",
        ".....#..",
        "........",
        ".......#",
        "..#.#...",
        "#..#.#..",
        "..#.....",
      ]),
    },
    {
      name: "9×12",
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
      expectedRelevantRocks: [
        1, 8, 13, 15, 16, 19, 26, 30, 34, 35, 45, 47, 56, 57, 61, 66, 67, 81,
        86, 87, 94, 100, 103,
      ],
      expectedBoard: parseIceFloorMazeBoard([
        ".#......#",
        "....#.##.",
        ".#......#",
        "...#...##",
        ".........",
        "#.#......",
        "..##...#.",
        "...##....",
        ".........",
        "#....##..",
        "....#....",
        ".#..#....",
      ]),
    },
  ];

  test.each(researchCases)(
    "$name の関わる岩と、無関係な岩を除いた盤面が Python と一致すること",
    ({ board, start, expectedRelevantRocks, expectedBoard }) => {
      const normalized = removeIceFloorMazeIrrelevantRocks(board, start);

      const relevantRocks = listIceFloorMazeRelevantRocks(
        board,
        exploreIceFloorMazeStops(board, start),
      );

      expect(relevantRocks).toEqual(expectedRelevantRocks);
      expect(normalized).toEqual(expectedBoard);
    },
  );

  test.each(researchCases)(
    "$name の岩を除いても停止点の間の移動を変えないこと",
    ({ board, start }) => {
      const normalized = removeIceFloorMazeIrrelevantRocks(board, start);

      const before = exploreIceFloorMazeStops(board, start);
      const after = exploreIceFloorMazeStops(normalized, start);

      expect(after.moveCounts).toEqual(before.moveCounts);
      expect(after.slides).toEqual(before.slides);
    },
  );
});
