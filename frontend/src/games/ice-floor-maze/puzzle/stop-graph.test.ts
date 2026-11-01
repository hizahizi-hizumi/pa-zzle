import { parseIceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import {
  exploreIceFloorMazeStops,
  listIceFloorMazeStopMoves,
} from "@/games/ice-floor-maze/puzzle/stop-graph";

describe("exploreIceFloorMazeStops", () => {
  // 0  #  2
  // 3  4  5
  // 6  7  #
  // 2 へは 0→6→7→4→5→2 と5手かかる。
  const board = parseIceFloorMazeBoard([".#.", "...", "..#"]);
  const origin = 0;

  test("起点から止まれる位置を最少手数とともに求めること", () => {
    const graph = exploreIceFloorMazeStops(board, origin);

    expect(Object.fromEntries(graph.moveCounts)).toEqual({
      0: 0,
      6: 1,
      7: 2,
      4: 3,
      3: 4,
      5: 4,
      2: 5,
    });
  });

  test("停止点を最少手数の昇順に並べること", () => {
    const graph = exploreIceFloorMazeStops(board, origin);

    const moveCounts = graph.stops.map((stop) => graph.moveCounts.get(stop));

    expect(moveCounts).toEqual([0, 1, 2, 3, 4, 4, 5]);
  });

  describe("要素のある盤面の場合", () => {
    const elementBoard = parseIceFloorMazeBoard([".b.", "...", "..c"]);

    test("停止点のグラフを作らないこと", () => {
      function act() {
        exploreIceFloorMazeStops(elementBoard, origin);
      }

      expect(act).toThrow();
    });
  });

  test("各停止点の4方向の滑りを、成立しない方向も含めて持つこと", () => {
    const graph = exploreIceFloorMazeStops(board, origin);

    const slideCounts = graph.stops.map(
      (stop) => graph.slides.get(stop)?.length,
    );

    expect(slideCounts).toEqual(graph.stops.map(() => 4));
  });

  describe("研究用 Python の固定盤面の場合", () => {
    // scripts/research/ice_floor_supply_experiment.py の random_board_candidates で作った盤面と開始位置。
    // 期待値は同じ盤面に対する explore の dist。
    const cases = [
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
        expectedMoveCounts: [
          [1, 4],
          [3, 5],
          [7, 2],
          [8, 1],
          [12, 0],
          [14, 3],
          [15, 1],
          [24, 3],
          [29, 7],
          [31, 2],
          [32, 2],
          [36, 1],
          [38, 2],
          [40, 2],
          [41, 3],
          [43, 6],
          [45, 6],
          [47, 5],
          [56, 5],
          [57, 4],
          [59, 4],
          [62, 3],
          [63, 4],
        ],
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
        expectedMoveCounts: [
          [0, 5],
          [2, 3],
          [7, 4],
          [20, 2],
          [22, 1],
          [24, 2],
          [25, 2],
          [27, 7],
          [28, 6],
          [29, 7],
          [31, 0],
          [33, 1],
          [36, 4],
          [38, 3],
          [44, 4],
          [54, 4],
          [55, 5],
          [58, 1],
          [60, 2],
          [63, 11],
          [65, 10],
          [72, 3],
          [75, 8],
          [78, 2],
          [80, 3],
          [90, 7],
          [91, 6],
          [93, 7],
          [95, 6],
          [98, 7],
          [99, 8],
          [101, 9],
          [102, 8],
          [104, 5],
          [107, 4],
        ],
      },
    ];

    test.each(cases)(
      "$name の停止点と最少手数が Python の explore と一致すること",
      ({ board: researchBoard, start, expectedMoveCounts }) => {
        const graph = exploreIceFloorMazeStops(researchBoard, start);

        const moveCounts = [...graph.moveCounts].sort(
          ([left], [right]) => left - right,
        );

        expect(moveCounts).toEqual(expectedMoveCounts);
      },
    );
  });
});

describe("listIceFloorMazeStopMoves", () => {
  const board = parseIceFloorMazeBoard([".#.", "...", "..#"]);
  const graph = exploreIceFloorMazeStops(board, 0);

  test("成立する方向の移動だけを返すこと", () => {
    const moves = listIceFloorMazeStopMoves(graph, 0);

    expect(moves.map(({ direction, to }) => ({ direction, to }))).toEqual([
      { direction: "down", to: 6 },
    ]);
  });
});
