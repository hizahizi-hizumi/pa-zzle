import { parseHitofudePuzzleBoard } from "@/games/hitofude-puzzle/puzzle/board";
import { createInitialHitofudePuzzleState } from "@/games/hitofude-puzzle/puzzle/state";
import {
  extendHitofudePuzzle,
  type HitofudePuzzleExtensionRejection,
  moveHitofudePuzzleHead,
  retractHitofudePuzzle,
  rewindHitofudePuzzle,
  traceHitofudePuzzle,
} from "@/games/hitofude-puzzle/puzzle/transitions";

// 0 1 2
// 3 # 5
// 6 7 8
const board = parseHitofudePuzzleBoard(["S . .", ". # .", ". . ."]);

describe("createInitialHitofudePuzzleState", () => {
  test("始点だけの道を作ること", () => {
    const state = createInitialHitofudePuzzleState(board);

    expect(state.path).toEqual([0]);
  });
});

describe("extendHitofudePuzzle", () => {
  const initialState = { path: [0] };

  test("先端に隣り合う未通過の有効マスへ1マス延ばすこと", () => {
    const extension = extendHitofudePuzzle(board, initialState, 1);

    expect(extension).toEqual({ kind: "extended", state: { path: [0, 1] } });
  });

  const rejections: readonly [
    string,
    readonly number[],
    number,
    HitofudePuzzleExtensionRejection,
  ][] = [
    ["盤面の外", [0], -1, "outside-board"],
    ["先端から離れたマス", [0], 2, "not-adjacent"],
    ["先端そのもの", [0], 0, "not-adjacent"],
    ["穴", [0, 1], 4, "hole"],
    ["通過済みのマス", [0, 3, 6, 7], 6, "visited"],
  ];

  test.each(rejections)(
    "%sへは延ばさず理由を返すこと",
    (_, path, cell, reason) => {
      const extension = extendHitofudePuzzle(board, { path }, cell);

      expect(extension).toEqual({ kind: "rejected", reason });
    },
  );
});

describe("retractHitofudePuzzle", () => {
  const state = { path: [0, 3, 6] };
  const initialState = { path: [0] };

  test("先端を1マス戻すこと", () => {
    const retracted = retractHitofudePuzzle(state);

    expect(retracted.path).toEqual([0, 3]);
  });

  test("始点だけの道は変えないこと", () => {
    const retracted = retractHitofudePuzzle(initialState);

    expect(retracted).toBe(initialState);
  });
});

describe("rewindHitofudePuzzle", () => {
  const state = { path: [0, 3, 6, 7, 8] };

  test("道の途中のマスまで巻き戻すこと", () => {
    const rewound = rewindHitofudePuzzle(state, 6);

    expect(rewound.path).toEqual([0, 3, 6]);
  });

  test("始点まで巻き戻すと始点だけの道になること", () => {
    const rewound = rewindHitofudePuzzle(state, 0);

    expect(rewound.path).toEqual([0]);
  });

  test.each([8, 1])("先端や道に無いマス %i では変えないこと", (cell) => {
    const rewound = rewindHitofudePuzzle(state, cell);

    expect(rewound).toBe(state);
  });
});

describe("moveHitofudePuzzleHead", () => {
  const state = { path: [0, 3, 6, 7] };

  test("直前のマスへ動かすと1マス縮むこと", () => {
    const move = moveHitofudePuzzleHead(board, state, 6);

    expect(move).toEqual({ kind: "retracted", state: { path: [0, 3, 6] } });
  });

  test("未通過のマスへ動かすと延びること", () => {
    const move = moveHitofudePuzzleHead(board, state, 8);

    expect(move).toEqual({
      kind: "extended",
      state: { path: [0, 3, 6, 7, 8] },
    });
  });

  describe("直前より前の通過済みのマスへ動かす場合", () => {
    const openBoard = parseHitofudePuzzleBoard(["S .", ". ."]);
    const loopingState = { path: [0, 1, 3, 2] };

    test("巻き戻さず、通過済みを理由に返すこと", () => {
      const move = moveHitofudePuzzleHead(openBoard, loopingState, 0);

      expect(move).toEqual({ kind: "rejected", reason: "visited" });
    });
  });
});

describe("traceHitofudePuzzle", () => {
  const openBoard = parseHitofudePuzzleBoard(["S . .", ". . .", ". . ."]);

  describe("指が先端から隣のマスへ移った場合", () => {
    const cases = [
      [
        "未通過のマスへは延ばす",
        [0, 3],
        6,
        { kind: "extended", state: { path: [0, 3, 6] } },
      ],
      [
        "直前のマスへは縮める",
        [0, 3, 6],
        3,
        { kind: "retracted", state: { path: [0, 3] } },
      ],
      [
        "穴へは延ばさず理由を返す",
        [0, 1],
        4,
        { kind: "rejected", reason: "hole" },
      ],
    ] as const;

    test.each(cases)("%sこと", (_, path, to, expected) => {
      const trace = traceHitofudePuzzle(
        board,
        { path },
        { from: path.at(-1)!, to, horizontalFirst: true },
      );

      expect(trace).toEqual(expected);
    });
  });

  describe("指が先端から直前より前の通過済みのマスへ移った場合", () => {
    test("巻き戻さず道を変えないこと", () => {
      const trace = traceHitofudePuzzle(
        openBoard,
        { path: [0, 1, 4, 3] },
        { from: 3, to: 0, horizontalFirst: false },
      );

      expect(trace).toEqual({ kind: "unchanged" });
    });
  });

  describe("道から外れた指が動いた場合", () => {
    test("先端の隣の未通過マスへ入ると延ばすこと", () => {
      const trace = traceHitofudePuzzle(
        openBoard,
        { path: [0, 1] },
        { from: 5, to: 2, horizontalFirst: true },
      );

      expect(trace).toEqual({ kind: "extended", state: { path: [0, 1, 2] } });
    });

    test("先端の隣の穴へ入っても理由を返さないこと", () => {
      const trace = traceHitofudePuzzle(
        board,
        { path: [0, 1] },
        { from: 5, to: 4, horizontalFirst: true },
      );

      expect(trace).toEqual({ kind: "unchanged" });
    });

    test("先端から離れたマスへは延ばさないこと", () => {
      const trace = traceHitofudePuzzle(
        openBoard,
        { path: [0] },
        { from: 1, to: 2, horizontalFirst: true },
      );

      expect(trace).toEqual({ kind: "unchanged" });
    });
  });

  describe("指が先端から斜めのマスへ移った場合", () => {
    const cases = [
      ["横の動きが大きいと横の角", true, [0, 1, 4]],
      ["縦の動きが大きいと縦の角", false, [0, 3, 4]],
    ] as const;

    test.each(cases)("%sを通って延ばすこと", (_, horizontalFirst, path) => {
      const trace = traceHitofudePuzzle(
        openBoard,
        { path: [0] },
        { from: 0, to: 4, horizontalFirst },
      );

      expect(trace).toEqual({ kind: "extended", state: { path } });
    });

    describe("片方の角が穴の場合", () => {
      const holedBoard = parseHitofudePuzzleBoard(["S # .", ". . .", ". . ."]);

      test("穴でない角を通って延ばすこと", () => {
        const trace = traceHitofudePuzzle(
          holedBoard,
          { path: [0] },
          { from: 0, to: 4, horizontalFirst: true },
        );

        expect(trace).toEqual({
          kind: "extended",
          state: { path: [0, 3, 4] },
        });
      });
    });

    describe("両方の角が穴の場合", () => {
      const blockedBoard = parseHitofudePuzzleBoard([
        "S # .",
        "# . .",
        ". . .",
      ]);

      test("延ばさないこと", () => {
        const trace = traceHitofudePuzzle(
          blockedBoard,
          { path: [0] },
          { from: 0, to: 4, horizontalFirst: true },
        );

        expect(trace).toEqual({ kind: "unchanged" });
      });
    });
  });

  describe("指が先端から一直線に2マス先へ移った場合", () => {
    test("間のマスを通って延ばすこと", () => {
      const trace = traceHitofudePuzzle(
        openBoard,
        { path: [0] },
        { from: 0, to: 6, horizontalFirst: false },
      );

      expect(trace).toEqual({ kind: "extended", state: { path: [0, 3, 6] } });
    });
  });
});
