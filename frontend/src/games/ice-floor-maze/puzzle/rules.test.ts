import { parseIceFloorMazeBoard } from "@/games/ice-floor-maze/puzzle/board";
import {
  doesIceFloorMazeSlidePassGoal,
  getIceFloorMazeNeighbor,
  type IceFloorMazeSlide,
  iceFloorMazeDirections,
  isIceFloorMazeCleared,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";

// 0  1  2  3  #
// 5  #  7  8  9
// 10 11 12 13 14
// #  16 17 18 19
const board = parseIceFloorMazeBoard(["....#", ".#...", ".....", "#...."]);

describe("getIceFloorMazeNeighbor", () => {
  const cases = [
    ["右隣", 0, "right", 1],
    ["下隣", 0, "down", 5],
    ["上の外壁", 0, "up", null],
    ["左の外壁", 10, "left", null],
    ["右の外壁", 14, "right", null],
    ["下の外壁", 18, "down", null],
  ] as const;

  test.each(cases)(
    "%sのマスを返すこと",
    (_, cellIndex, direction, expected) => {
      const result = getIceFloorMazeNeighbor(board, cellIndex, direction);

      expect(result).toBe(expected);
    },
  );
});

describe("slideIceFloorMazePiece", () => {
  const slidCases = [
    ["岩の手前で止まる", 0, "right", 3, [1, 2, 3]],
    ["下の岩の手前で止まる", 0, "down", 10, [5, 10]],
    ["外壁で止まる", 10, "right", 14, [11, 12, 13, 14]],
    ["上へ外壁まで滑る", 17, "up", 2, [12, 7, 2]],
    ["1マスだけ進んで止まる", 11, "down", 16, [16]],
  ] as const;

  test.each(slidCases)(
    "%sこと",
    (_, from, direction, expectedTo, expectedPath) => {
      const slide = slideIceFloorMazePiece(board, from, direction);

      expect(slide).toEqual({
        status: "slid",
        direction,
        from,
        to: expectedTo,
        path: expectedPath,
      });
    },
  );

  const blockedCases = [
    ["すぐ上が外壁", 0, "up"],
    ["すぐ右が岩", 5, "right"],
    ["すぐ上が岩", 11, "up"],
  ] as const;

  test.each(blockedCases)(
    "%sなら移動として成立しないこと",
    (_, from, direction) => {
      const slide = slideIceFloorMazePiece(board, from, direction);

      expect(slide).toEqual({ status: "blocked", direction, from });
    },
  );

  describe("研究用 Python の固定盤面の場合", () => {
    // scripts/research/ice_floor_supply_experiment.py の random_board_candidates(8, 8, Random("fixture-8x8"), 0.2) の159盤面目。
    const researchBoard = parseIceFloorMazeBoard([
      "#...#.#.",
      "........",
      ".....#..",
      "........",
      ".......#",
      "..#.#...",
      "#.##.#..",
      "..#.....",
    ]);
    const start = 12;
    const expectedSlides: IceFloorMazeSlide[] = [
      { status: "blocked", direction: "up", from: 12 },
      {
        status: "slid",
        direction: "right",
        from: 12,
        to: 15,
        path: [13, 14, 15],
      },
      {
        status: "slid",
        direction: "down",
        from: 12,
        to: 36,
        path: [20, 28, 36],
      },
      {
        status: "slid",
        direction: "left",
        from: 12,
        to: 8,
        path: [11, 10, 9, 8],
      },
    ];

    test("開始位置からの4方向の止まる位置と通ったマスが Python の slide と一致すること", () => {
      const slides = iceFloorMazeDirections.map((direction) =>
        slideIceFloorMazePiece(researchBoard, start, direction),
      );

      expect(slides).toEqual(expectedSlides);
    });
  });
});

describe("isIceFloorMazeCleared", () => {
  const goal = 12;
  const cases = [
    ["ゴールで止まっていればクリアとする", 12, true],
    ["ゴール以外ではクリアとしない", 13, false],
  ] as const;

  test.each(cases)("%sこと", (_, position, expected) => {
    const result = isIceFloorMazeCleared(position, goal);

    expect(result).toBe(expected);
  });
});

describe("doesIceFloorMazeSlidePassGoal", () => {
  const slideThroughGoal = slideIceFloorMazePiece(board, 10, "right");
  const blockedSlide = slideIceFloorMazePiece(board, 0, "up");
  const cases = [
    ["途中でゴールを通り過ぎた滑りを通過とする", slideThroughGoal, 12, true],
    ["ゴールで止まった滑りを通過としない", slideThroughGoal, 14, false],
    ["ゴールを通らない滑りを通過としない", slideThroughGoal, 7, false],
    ["成立しない方向を通過としない", blockedSlide, 0, false],
  ] as const;

  test.each(cases)("%sこと", (_, slide, goal, expected) => {
    const result = doesIceFloorMazeSlidePassGoal(slide, goal);

    expect(result).toBe(expected);
  });
});
