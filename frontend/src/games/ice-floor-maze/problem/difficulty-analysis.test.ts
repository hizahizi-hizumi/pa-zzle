import { analyzeIceFloorMazeDifficulty } from "@/games/ice-floor-maze/problem/difficulty-analysis";
import { parseIceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";

describe("analyzeIceFloorMazeDifficulty", () => {
  describe("研究用 Python の固定盤面の場合", () => {
    // scripts/research/ice_floor_supply_experiment.py の random_board_candidates で作った盤面から無関係な岩を除いたもの。
    // 期待値は、岩を除く前の盤面に対する ice_floor_difficulty_experiment.py の analyze の値（計画深さ7は評価不能）。
    // 無関係な岩を除いても特徴が変わらないことも併せて確かめる。
    const notatedCases = [
      {
        name: "8×8 のレベル1",
        rows: [
          "#.......",
          ".......#",
          "#...#...",
          ".###....",
          "#..##.#.",
          ".....#..",
          "#.......",
          "...##...",
        ],
        start: 62,
        goal: 5,
        expected: {
          optimalMoveCount: 4,
          optimalSolutionCount: 1,
          reachableStopCount: 22,
          approachPlanningDepth: 1,
          alignPlanningDepth: 1,
          trialMoveCount: 5,
          detourMoveCount: 1,
          goalPassingStopCount: 3,
          deadStopCount: 10,
        },
      },
      {
        name: "8×10 のレベル2",
        rows: [
          "....#..#",
          ".####...",
          "........",
          "#.......",
          "........",
          ".......#",
          "........",
          ".......#",
          "........",
          ".#......",
        ],
        start: 28,
        goal: 6,
        expected: {
          optimalMoveCount: 5,
          optimalSolutionCount: 1,
          reachableStopCount: 25,
          approachPlanningDepth: 1,
          alignPlanningDepth: 1,
          trialMoveCount: 5,
          detourMoveCount: 1,
          goalPassingStopCount: 0,
          deadStopCount: 0,
        },
      },
      {
        name: "9×12 のレベル3",
        rows: [
          ".......##",
          ".#.......",
          "..#......",
          "#...#....",
          "#........",
          ".........",
          ".#.#.....",
          "..#.....#",
          "#........",
          "....#....",
          ".........",
          ".........",
        ],
        start: 67,
        goal: 105,
        expected: {
          optimalMoveCount: 6,
          optimalSolutionCount: 1,
          reachableStopCount: 32,
          approachPlanningDepth: 4,
          alignPlanningDepth: 3,
          trialMoveCount: 32,
          detourMoveCount: 3,
          goalPassingStopCount: 5,
          deadStopCount: 0,
        },
      },
      {
        name: "10×13 のレベル4",
        rows: [
          "..........",
          "#........#",
          "...#.##..#",
          "..........",
          "#.#.#.....",
          "#........#",
          "..#.#.....",
          ".......##.",
          "......#...",
          "...#.....#",
          ".#.....#..",
          "..........",
          "..#.#.....",
        ],
        start: 66,
        goal: 1,
        expected: {
          optimalMoveCount: 5,
          optimalSolutionCount: 1,
          reachableStopCount: 43,
          approachPlanningDepth: 5,
          alignPlanningDepth: 4,
          trialMoveCount: 27,
          detourMoveCount: 1,
          goalPassingStopCount: 3,
          deadStopCount: 2,
        },
      },
      {
        name: "8×8 のレベル5（2方針で深さが違う）",
        rows: [
          "....#...",
          "......#.",
          "........",
          "...#.#..",
          ".....#..",
          "#..#...#",
          "........",
          "......##",
        ],
        start: 56,
        goal: 32,
        expected: {
          optimalMoveCount: 6,
          optimalSolutionCount: 2,
          reachableStopCount: 25,
          approachPlanningDepth: 6,
          alignPlanningDepth: 5,
          trialMoveCount: 11,
          detourMoveCount: 2,
          goalPassingStopCount: 0,
          deadStopCount: 0,
        },
      },
      {
        name: "12×14 のレベル5",
        rows: [
          "..#.........",
          "......#...#.",
          "#.#.........",
          "...........#",
          "#...........",
          ".....#....#.",
          "........##..",
          "............",
          ".#..........",
          "..........#.",
          "....#.......",
          "......##....",
          ".#.......#..",
          ".......##...",
        ],
        start: 86,
        goal: 140,
        expected: {
          optimalMoveCount: 7,
          optimalSolutionCount: 1,
          reachableStopCount: 41,
          approachPlanningDepth: 5,
          alignPlanningDepth: 5,
          trialMoveCount: 47,
          detourMoveCount: 2,
          goalPassingStopCount: 2,
          deadStopCount: 0,
        },
      },
      {
        name: "12×14 の評価不能",
        rows: [
          ".........#..",
          "..#...#.....",
          "#.......#.##",
          "..##...#....",
          ".#..#.#.....",
          ".....#..#...",
          ".........#..",
          "..#.........",
          "..#....#....",
          "............",
          "............",
          ".....#..#.#.",
          "..#......#..",
          ".#..#..#...#",
        ],
        start: 110,
        goal: 131,
        expected: {
          optimalMoveCount: 10,
          optimalSolutionCount: 1,
          reachableStopCount: 50,
          approachPlanningDepth: null,
          alignPlanningDepth: null,
          trialMoveCount: 16,
          detourMoveCount: 5,
          goalPassingStopCount: 5,
          deadStopCount: 17,
        },
      },
    ];
    const cases = notatedCases.map(({ rows, ...notatedCase }) => ({
      ...notatedCase,
      board: parseIceFloorMazeBoard(rows),
    }));

    test.each(cases)(
      "$name の特徴が Python の analyze と一致すること",
      ({ board, start, goal, expected }) => {
        const analysis = analyzeIceFloorMazeDifficulty({ board, start, goal });

        expect(
          analysis.status === "invalid" ? null : analysis.features,
        ).toEqual(expected);
      },
    );
  });

  describe("2方針で計画深さが違う場合", () => {
    const problem = {
      board: parseIceFloorMazeBoard([
        "....#...",
        "......#.",
        "........",
        "...#.#..",
        ".....#..",
        "#..#...#",
        "........",
        "......##",
      ]),
      start: 56,
      goal: 32,
    };

    test("小さい方の読み手数を計画深さとし、それを与えた方針を添えること", () => {
      const analysis = analyzeIceFloorMazeDifficulty(problem);

      expect(analysis).toMatchObject({
        status: "analyzed",
        shape: { width: 8, height: 8 },
        planningDepth: 5,
        strategies: ["align"],
      });
    });
  });

  describe("どちらの方針でも読む手数の上限までに解けない場合", () => {
    const problem = {
      board: parseIceFloorMazeBoard([
        ".........#..",
        "..#...#.....",
        "#.......#.##",
        "..##...#....",
        ".#..#.#.....",
        ".....#..#...",
        ".........#..",
        "..#.........",
        "..#....#....",
        "............",
        "............",
        ".....#..#.#.",
        "..#......#..",
        ".#..#..#...#",
      ]),
      start: 110,
      goal: 131,
    };

    test("評価不能とすること", () => {
      const analysis = analyzeIceFloorMazeDifficulty(problem);

      expect(analysis).toMatchObject({
        status: "unsupported",
        reason: "planning-depth-limit-exceeded",
      });
    });
  });

  describe("ゴールへ止まれない場合", () => {
    // 開始位置 0 から止まれるのは 2・6・8 だけで、中央の 4 には止まれない。
    const problem = {
      board: parseIceFloorMazeBoard(["...", "...", "..."]),
      start: 0,
      goal: 4,
    };

    test("問題として成立しないとすること", () => {
      const analysis = analyzeIceFloorMazeDifficulty(problem);

      expect(analysis).toEqual({
        status: "invalid",
        reason: "goal-unreachable",
        shape: { width: 3, height: 3 },
      });
    });
  });
});
