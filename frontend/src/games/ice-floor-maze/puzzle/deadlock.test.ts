import {
  type IceFloorMazeBoard,
  parseIceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import { classifyIceFloorMazeDeadlock } from "@/games/ice-floor-maze/puzzle/deadlock";
import {
  applyIceFloorMazeSlide,
  type IceFloorMazeDirection,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import {
  createIceFloorMazeInitialState,
  type IceFloorMazeState,
} from "@/games/ice-floor-maze/puzzle/state";
import { exploreIceFloorMazeStops } from "@/games/ice-floor-maze/puzzle/stop-graph";

/** どの要素もまだ変わっていない盤面で、駒を `start` に置いて滑りを重ねた状態。 */
function slideInOrder(
  board: IceFloorMazeBoard,
  start: number,
  directions: readonly IceFloorMazeDirection[],
): IceFloorMazeState {
  return directions.reduce(
    (state, direction) => {
      const slide = slideIceFloorMazePiece(board, state, direction);
      if (slide.status === "blocked") {
        throw new Error(`blocked: ${direction} from ${state.position}`);
      }
      return applyIceFloorMazeSlide(state, slide);
    },
    createIceFloorMazeInitialState(board, start),
  );
}

describe("classifyIceFloorMazeDeadlock", () => {
  // 8×8 の研究用盤面（下の Python 一致の8×8と同じ）。開始位置 12、ゴール 29。
  const board = parseIceFloorMazeBoard([
    "#...#.#.",
    "........",
    ".....#..",
    "........",
    ".......#",
    "..#.#...",
    "#.##.#..",
    "..#.....",
  ]);
  const goal = 29;
  const cases = [
    ["開始位置からはゴールで止まれる", 12, "goal-reachable"],
    ["ゴールにいればゴールで止まれる", 29, "goal-reachable"],
    ["ゴールで止まれないが、まだ別の位置へ抜けられる", 8, "goal-unreachable"],
    ["ゴールの無い領域から出られない", 56, "trapped"],
  ] as const;

  test.each(cases)("%sと判定すること", (_, position, expected) => {
    const status = classifyIceFloorMazeDeadlock(
      board,
      createIceFloorMazeInitialState(board, position),
      goal,
    );

    expect(status).toBe(expected);
  });

  describe("要素のある盤面の場合", () => {
    // G # 2 3 b 5 6
    const brittleBoard = parseIceFloorMazeBoard([".#..b.."]);
    // G # 2 c 4
    const thinBoard = parseIceFloorMazeBoard([".#.c."]);
    // G b 2 3 4
    const reachableBoard = parseIceFloorMazeBoard([".b..."]);
    // G 1 2 b 4
    const pushedBoard = parseIceFloorMazeBoard(["...b."]);
    const elementCases = [
      [
        "もろい岩を崩せばゴールで止まれる",
        reachableBoard,
        slideInOrder(reachableBoard, 4, []),
        "goal-reachable",
      ],
      [
        "もろい岩を崩す手が残る間は、ゴールが無くても閉じ込めでない",
        brittleBoard,
        slideInOrder(brittleBoard, 6, []),
        "goal-unreachable",
      ],
      [
        "崩した後に戻れない状態は閉じ込めでない",
        brittleBoard,
        slideInOrder(brittleBoard, 6, ["left"]),
        "goal-unreachable",
      ],
      [
        "崩した後の往復だけが残れば閉じ込め",
        brittleBoard,
        slideInOrder(brittleBoard, 6, ["left", "left"]),
        "trapped",
      ],
      [
        "薄い氷を割る手が残る間は閉じ込めでない",
        thinBoard,
        slideInOrder(thinBoard, 4, []),
        "goal-unreachable",
      ],
      [
        "割れた水面に阻まれて動けなければ閉じ込め",
        thinBoard,
        slideInOrder(thinBoard, 4, ["left"]),
        "trapped",
      ],
      [
        "隣のもろい岩は押しても崩れないので、動けなければ閉じ込め",
        pushedBoard,
        slideInOrder(pushedBoard, 4, []),
        "trapped",
      ],
    ] as const;

    test.each(elementCases)(
      "%sと判定すること",
      (_, elementBoard, state, expected) => {
        const status = classifyIceFloorMazeDeadlock(elementBoard, state, 0);

        expect(status).toBe(expected);
      },
    );
  });

  describe("研究用 Python の固定盤面の場合", () => {
    // scripts/research/ice_floor_supply_experiment.py の random_board_candidates で作った盤面と開始位置に、
    // 最も遠い停止点をゴールにした問題。期待値は ice_floor_difficulty_experiment.py の
    // trap_structure の dead（詰み）と trapped（閉じ込め）。
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
        goal: 29,
        expectedDead: [1, 3, 7, 8, 15, 24, 31, 40, 41, 43, 56, 57],
        expectedTrapped: [1, 3, 43, 56, 57],
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
        goal: 63,
        expectedDead: [0, 2, 7, 20, 25, 27, 29, 36, 38, 44, 95, 98, 104, 107],
        expectedTrapped: [0, 36, 44, 95, 98, 104, 107],
      },
    ];

    test.each(researchCases)(
      "$name の到達できる各停止点の詰みと閉じ込めが Python の trap_structure と一致すること",
      ({
        board: researchBoard,
        start,
        goal: researchGoal,
        expectedDead,
        expectedTrapped,
      }) => {
        const { stops } = exploreIceFloorMazeStops(researchBoard, start);

        const statuses = stops
          .map((stop) => ({
            stop,
            status: classifyIceFloorMazeDeadlock(
              researchBoard,
              createIceFloorMazeInitialState(researchBoard, stop),
              researchGoal,
            ),
          }))
          .sort((left, right) => left.stop - right.stop);
        const dead = statuses
          .filter(({ status }) => status !== "goal-reachable")
          .map(({ stop }) => stop);
        const trapped = statuses
          .filter(({ status }) => status === "trapped")
          .map(({ stop }) => stop);

        expect(dead).toEqual(expectedDead);
        expect(trapped).toEqual(expectedTrapped);
      },
    );
  });
});
