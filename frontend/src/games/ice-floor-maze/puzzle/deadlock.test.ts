import {
  type IceFloorMazeBoard,
  parseIceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import { findIceFloorMazeDeadlock } from "@/games/ice-floor-maze/puzzle/deadlock";
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

describe("findIceFloorMazeDeadlock", () => {
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
    ["開始位置からはゴールで止まれるので詰みでない", 12, false],
    ["ゴールにいれば詰みでない", 29, false],
    ["ゴールで止まれなければ、まだ別の位置へ抜けられても詰み", 8, true],
    ["ゴールの無い領域から出られなければ詰み", 56, true],
  ] as const;

  test.each(cases)("%sと判定すること", (_, position, expected) => {
    const deadlock = findIceFloorMazeDeadlock(
      board,
      createIceFloorMazeInitialState(board, position),
      goal,
    );

    expect(deadlock !== null).toBe(expected);
  });

  describe("要素のある盤面の場合", () => {
    // G # 2 3 b 5 6
    const brittleBoard = parseIceFloorMazeBoard([".#..b.."]);
    // G # 2 c 4
    const thinBoard = parseIceFloorMazeBoard([".#.c."]);
    // G b 2 3 4
    const reachableBoard = parseIceFloorMazeBoard([".b..."]);
    // 0 1 2 s G
    const snowGoalBoard = parseIceFloorMazeBoard(["...s."]);
    // 0 1 m G #
    const blockGoalBoard = parseIceFloorMazeBoard(["..m.#"]);
    const elementCases = [
      [
        "もろい岩を崩せばゴールで止まれるので詰みでない",
        reachableBoard,
        slideInOrder(reachableBoard, 4, []),
        0,
        null,
      ],
      [
        "崩す手が残っていても、どう滑ってもゴールへ行けなければ詰みで、崩す前の1つと崩した後の3つへ移れる",
        brittleBoard,
        slideInOrder(brittleBoard, 6, []),
        0,
        { reachableStateCount: 4 },
      ],
      [
        "割る手が残っていても、どう滑ってもゴールへ行けなければ詰みで、割る前と割った後の2つへ移れる",
        thinBoard,
        slideInOrder(thinBoard, 4, []),
        0,
        { reachableStateCount: 2 },
      ],
      [
        "雪山でゴールが埋まれば詰みで、両端の2つへ移れる",
        snowGoalBoard,
        slideInOrder(snowGoalBoard, 0, ["right"]),
        4,
        { reachableStateCount: 2 },
      ],
      [
        "動かせない塊がゴールに乗れば詰みで、両端の2つへ移れる",
        blockGoalBoard,
        slideInOrder(blockGoalBoard, 0, ["right"]),
        3,
        { reachableStateCount: 2 },
      ],
    ] as const;

    test.each(elementCases)(
      "%sと判定すること",
      (_, elementBoard, state, goalCell, expected) => {
        const deadlock = findIceFloorMazeDeadlock(
          elementBoard,
          state,
          goalCell,
        );

        expect(deadlock).toEqual(expected);
      },
    );
  });

  describe("研究用 Python の固定盤面の場合", () => {
    // scripts/research/ice_floor_supply_experiment.py の random_board_candidates で作った盤面と開始位置に、
    // 最も遠い停止点をゴールにした問題。期待値は ice_floor_difficulty_experiment.py の
    // trap_structure の dead（詰み）。
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
      },
    ];

    test.each(researchCases)(
      "$name の到達できる各停止点の詰みが Python の trap_structure と一致すること",
      ({ board: researchBoard, start, goal: researchGoal, expectedDead }) => {
        const { stops } = exploreIceFloorMazeStops(researchBoard, start);

        const dead = stops
          .filter(
            (stop) =>
              findIceFloorMazeDeadlock(
                researchBoard,
                createIceFloorMazeInitialState(researchBoard, stop),
                researchGoal,
              ) !== null,
          )
          .sort((left, right) => left - right);

        expect(dead).toEqual(expectedDead);
      },
    );
  });
});
