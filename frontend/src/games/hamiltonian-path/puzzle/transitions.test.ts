import { parseHamiltonianPathBoard } from "@/games/hamiltonian-path/puzzle/board";
import { createInitialHamiltonianPathState } from "@/games/hamiltonian-path/puzzle/state";
import {
  extendHamiltonianPath,
  type HamiltonianPathExtensionRejection,
  moveHamiltonianPathHead,
  retractHamiltonianPath,
  rewindHamiltonianPath,
} from "@/games/hamiltonian-path/puzzle/transitions";

// 0 1|2
// 3 4 5    (4 は壁、5 と 8 の間に仕切り)
// 6 7 8
const board = parseHamiltonianPathBoard([
  "S .|.",
  "     ",
  ". # .",
  "    -",
  ". . .",
]);

describe("createInitialHamiltonianPathState", () => {
  test("始点だけの道を作ること", () => {
    const state = createInitialHamiltonianPathState(board);

    expect(state.path).toEqual([0]);
  });
});

describe("extendHamiltonianPath", () => {
  const initialState = { path: [0] };

  test("先端に隣り合う未通過の有効マスへ1マス延ばすこと", () => {
    const extension = extendHamiltonianPath(board, initialState, 1);

    expect(extension).toEqual({ kind: "extended", state: { path: [0, 1] } });
  });

  const rejections: readonly [
    string,
    readonly number[],
    number,
    HamiltonianPathExtensionRejection,
  ][] = [
    ["盤面の外", [0], -1, "outside-board"],
    ["先端から離れたマス", [0], 2, "not-adjacent"],
    ["先端そのもの", [0], 0, "not-adjacent"],
    ["壁マス", [0, 1], 4, "wall"],
    ["仕切りの向こう", [0, 1], 2, "partition"],
    ["通過済みのマス", [0, 3, 6, 7], 6, "visited"],
  ];

  test.each(rejections)(
    "%sへは延ばさず理由を返すこと",
    (_, path, cell, reason) => {
      const extension = extendHamiltonianPath(board, { path }, cell);

      expect(extension).toEqual({ kind: "rejected", reason });
    },
  );

  describe("仕切りを挟んだ通過済みのマスの場合", () => {
    const partitionedBoard = parseHamiltonianPathBoard(["S|.", "   ", ". ."]);
    const state = { path: [0, 2, 3, 1] };

    test("仕切りを理由に返すこと", () => {
      const extension = extendHamiltonianPath(partitionedBoard, state, 0);

      expect(extension).toEqual({ kind: "rejected", reason: "partition" });
    });
  });
});

describe("retractHamiltonianPath", () => {
  const state = { path: [0, 3, 6] };
  const initialState = { path: [0] };

  test("先端を1マス戻すこと", () => {
    const retracted = retractHamiltonianPath(state);

    expect(retracted.path).toEqual([0, 3]);
  });

  test("始点だけの道は変えないこと", () => {
    const retracted = retractHamiltonianPath(initialState);

    expect(retracted).toBe(initialState);
  });
});

describe("rewindHamiltonianPath", () => {
  const state = { path: [0, 3, 6, 7, 8] };

  test("道の途中のマスまで巻き戻すこと", () => {
    const rewound = rewindHamiltonianPath(state, 6);

    expect(rewound.path).toEqual([0, 3, 6]);
  });

  test("始点まで巻き戻すと始点だけの道になること", () => {
    const rewound = rewindHamiltonianPath(state, 0);

    expect(rewound.path).toEqual([0]);
  });

  test.each([8, 1])("先端や道に無いマス %i では変えないこと", (cell) => {
    const rewound = rewindHamiltonianPath(state, cell);

    expect(rewound).toBe(state);
  });
});

describe("moveHamiltonianPathHead", () => {
  const state = { path: [0, 3, 6, 7] };

  test("直前のマスへ動かすと1マス縮むこと", () => {
    const move = moveHamiltonianPathHead(board, state, 6);

    expect(move).toEqual({ kind: "retracted", state: { path: [0, 3, 6] } });
  });

  test("未通過のマスへ動かすと延びること", () => {
    const move = moveHamiltonianPathHead(board, state, 8);

    expect(move).toEqual({
      kind: "extended",
      state: { path: [0, 3, 6, 7, 8] },
    });
  });

  describe("直前より前の通過済みのマスへ動かす場合", () => {
    const openBoard = parseHamiltonianPathBoard(["S .", "   ", ". ."]);
    const loopingState = { path: [0, 1, 3, 2] };

    test("巻き戻さず、通過済みを理由に返すこと", () => {
      const move = moveHamiltonianPathHead(openBoard, loopingState, 0);

      expect(move).toEqual({ kind: "rejected", reason: "visited" });
    });
  });
});
