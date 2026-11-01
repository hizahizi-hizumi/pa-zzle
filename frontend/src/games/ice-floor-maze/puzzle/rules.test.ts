import {
  type IceFloorMazeBoard,
  parseIceFloorMazeBoard,
} from "@/games/ice-floor-maze/puzzle/board";
import {
  applyIceFloorMazeSlide,
  doesIceFloorMazeSlidePassGoal,
  getIceFloorMazeNeighbor,
  type IceFloorMazeDirection,
  type IceFloorMazeSlide,
  iceFloorMazeDirections,
  isIceFloorMazeCleared,
  slideIceFloorMazePiece,
} from "@/games/ice-floor-maze/puzzle/rules";
import {
  createIceFloorMazeInitialState,
  type IceFloorMazeState,
} from "@/games/ice-floor-maze/puzzle/state";

/** どの要素もまだ変わっていない盤面で、駒を `from` に置いた状態から滑らせる。 */
function slideFrom(
  initialBoard: IceFloorMazeBoard,
  from: number,
  direction: IceFloorMazeDirection,
): IceFloorMazeSlide {
  return slideIceFloorMazePiece(
    initialBoard,
    createIceFloorMazeInitialState(initialBoard, from),
    direction,
  );
}

/** 滑りを重ねる。成立しない向きがあれば失敗させる。 */
function slideInOrder(
  elementBoard: IceFloorMazeBoard,
  start: number,
  directions: readonly IceFloorMazeDirection[],
): IceFloorMazeState {
  return directions.reduce(
    (state, direction) => {
      const slide = slideIceFloorMazePiece(elementBoard, state, direction);
      if (slide.status === "blocked") {
        throw new Error(`blocked: ${direction} from ${state.position}`);
      }
      return applyIceFloorMazeSlide(state, slide);
    },
    createIceFloorMazeInitialState(elementBoard, start),
  );
}

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
      const slide = slideFrom(board, from, direction);

      expect(slide).toEqual({
        status: "slid",
        direction,
        from,
        to: expectedTo,
        path: expectedPath,
        crumbledRock: null,
        crackedIce: [],
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
      const slide = slideFrom(board, from, direction);

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
    const expectedSlides = [
      { status: "blocked" },
      { status: "slid", to: 15, path: [13, 14, 15] },
      { status: "slid", to: 36, path: [20, 28, 36] },
      { status: "slid", to: 8, path: [11, 10, 9, 8] },
    ];

    test("開始位置からの4方向の止まる位置と通ったマスが Python の slide と一致すること", () => {
      const slides = iceFloorMazeDirections.map((direction) =>
        slideFrom(researchBoard, start, direction),
      );

      expect(slides).toMatchObject(expectedSlides);
    });
  });

  // 研究用 Python（scripts/research/ice_floor_hardest_generation_experiment.py）の run_hand_checks と同じ盤面と手。
  describe("もろい岩の場合", () => {
    // 0 1 2 3 b 5
    const brittleBoard = parseIceFloorMazeBoard(["....b."]);

    test("手前で止まり、そのもろい岩を崩すこと", () => {
      const slide = slideFrom(brittleBoard, 0, "right");

      expect(slide).toMatchObject({
        status: "slid",
        to: 3,
        crumbledRock: 4,
        crackedIce: [],
      });
    });

    test("崩れたもろい岩が滑りの後の盤面で氷になること", () => {
      const state = slideInOrder(brittleBoard, 0, ["right"]);

      expect(state).toEqual({
        position: 3,
        cells: ["ice", "ice", "ice", "ice", "ice", "ice"],
      });
    });

    test("崩れた跡を通り抜けること", () => {
      const state = slideInOrder(brittleBoard, 0, ["right", "left", "right"]);

      expect(state.position).toBe(5);
    });

    describe("隣のもろい岩へ向けて動けない場合", () => {
      // 0 b
      // 2 3
      const adjacentBoard = parseIceFloorMazeBoard([".b", ".."]);

      test("手にならず、崩さないこと", () => {
        const slide = slideFrom(adjacentBoard, 0, "right");

        expect(slide).toEqual({
          status: "blocked",
          direction: "right",
          from: 0,
        });
      });
    });
  });

  describe("薄い氷の場合", () => {
    // 0 c 2 # 4 5
    const passingBoard = parseIceFloorMazeBoard([".c.#.."]);

    test("通過した薄い氷を割ること", () => {
      const slide = slideFrom(passingBoard, 0, "right");

      expect(slide).toMatchObject({
        status: "slid",
        to: 2,
        crumbledRock: null,
        crackedIce: [1],
      });
    });

    test("割れた薄い氷が滑りの後の盤面で水面になること", () => {
      const state = slideInOrder(passingBoard, 0, ["right"]);

      expect(state.cells[1]).toBe("water");
    });

    test("水面は止め役になること", () => {
      const state = slideInOrder(passingBoard, 0, ["right"]);

      const slide = slideIceFloorMazePiece(passingBoard, state, "left");

      expect(slide.status).toBe("blocked");
    });

    describe("薄い氷で止まった場合", () => {
      // c 1
      // 2 3
      const restingBoard = parseIceFloorMazeBoard(["c.", ".."]);
      const restingState = slideInOrder(restingBoard, 1, ["left"]);

      test("止まっている間は割れないこと", () => {
        const state = slideInOrder(restingBoard, 1, ["left"]);

        expect(state).toEqual({ position: 0, cells: restingBoard.cells });
      });

      test("動けない入力では割れないこと", () => {
        const slides = (["up", "left"] as const).map((direction) =>
          slideIceFloorMazePiece(restingBoard, restingState, direction),
        );

        expect(slides.map(({ status }) => status)).toEqual([
          "blocked",
          "blocked",
        ]);
      });

      test("そこから動いた滑りで、出発マスを割ること", () => {
        const slide = slideIceFloorMazePiece(
          restingBoard,
          restingState,
          "down",
        );

        expect(slide).toMatchObject({ status: "slid", to: 2, crackedIce: [0] });
      });

      test("割れた後の水面の手前で止まること", () => {
        const state = slideInOrder(restingBoard, 1, [
          "left",
          "down",
          "right",
          "up",
        ]);

        const slide = slideIceFloorMazePiece(restingBoard, state, "left");

        expect(state.position).toBe(1);
        expect(slide.status).toBe("blocked");
      });
    });
  });

  describe("1回の滑りで薄い氷を割り、もろい岩も崩す場合", () => {
    // 0 c 2 3 b 5
    const mixedBoard = parseIceFloorMazeBoard([".c..b."]);

    test("割ったマスと崩したマスの両方を返すこと", () => {
      const slide = slideFrom(mixedBoard, 0, "right");

      expect(slide).toMatchObject({
        status: "slid",
        to: 3,
        crumbledRock: 4,
        crackedIce: [1],
      });
    });

    test("戻る滑りが割れた薄い氷の手前で止まること", () => {
      const state = slideInOrder(mixedBoard, 0, ["right", "left"]);

      expect(state.position).toBe(2);
    });
  });

  describe("盤面の外の場合", () => {
    // 0 1 x 3 4
    const outsideBoard = parseIceFloorMazeBoard(["..x.."]);

    test("外壁と同じ止め役になること", () => {
      const slide = slideFrom(outsideBoard, 0, "right");

      expect(slide).toMatchObject({ status: "slid", to: 1 });
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
  const slideThroughGoal = slideFrom(board, 10, "right");
  const blockedSlide = slideFrom(board, 0, "up");
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

describe("applyIceFloorMazeSlide", () => {
  // 0 c 2 3 b 5
  const mixedBoard = parseIceFloorMazeBoard([".c..b."]);
  const initial = createIceFloorMazeInitialState(mixedBoard, 0);
  const crossing = slideIceFloorMazePiece(mixedBoard, initial, "right");
  // 0 1 2 3
  const iceBoard = parseIceFloorMazeBoard(["...."]);
  const iceInitial = createIceFloorMazeInitialState(iceBoard, 0);
  const plain = slideIceFloorMazePiece(iceBoard, iceInitial, "right");

  test("駒を止まったマスへ移し、崩したもろい岩を氷に、割った薄い氷を水面にすること", () => {
    const state =
      crossing.status === "slid"
        ? applyIceFloorMazeSlide(initial, crossing)
        : null;

    expect(state).toEqual({
      position: 3,
      cells: ["ice", "water", "ice", "ice", "ice", "ice"],
    });
  });

  test("どの要素も変わらなければ盤面のマスの配列を共有すること", () => {
    const state =
      plain.status === "slid"
        ? applyIceFloorMazeSlide(iceInitial, plain)
        : null;

    expect(state?.position).toBe(3);
    expect(state?.cells).toBe(iceBoard.cells);
  });
});
