// @vitest-environment node

import {
  applySlidePuzzleSlide,
  getSlidePuzzleKeyboardSlide,
  getSlidePuzzleSlide,
  isSolvableSlidePuzzleBoard,
  listSlidePuzzleSingleMoves,
  type SlidePuzzleDirection,
} from "@/games/slide-puzzle/puzzle/rules";

// 空白が 2 行 2 列目にある盤面
// [ 1,  2,  3,  4]
// [ 5,  _,  6,  7]
// [ 8,  9, 10, 11]
// [12, 13, 14, 15]
const board = [1, 2, 3, 4, 5, 0, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

// 空白が中央にある 3×3
// [1, 2, 3]
// [4, _, 5]
// [6, 7, 8]
const threeByThreeBoard = [1, 2, 3, 4, 0, 5, 6, 7, 8];
// 空白が中央（3 行 3 列目）にある 5×5
const fiveByFiveBoard = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23, 24,
];

describe("getSlidePuzzleSlide", () => {
  const slidableCases = [
    ["左隣のタイル", 4, "right", [4]],
    ["同じ行の離れたタイル", 7, "left", [6, 7]],
    ["上隣のタイル", 1, "down", [1]],
    ["同じ列の離れたタイル", 13, "up", [9, 13]],
  ] as const;

  test.each(slidableCases)(
    "空白と同じ行・列のタイルから空白までをまとめて動かすこと: %s",
    (_, tileIndex, direction, movedTileIndices) => {
      const result = getSlidePuzzleSlide(board, tileIndex);

      expect(result).toEqual({ direction, movedTileIndices });
    },
  );

  const unslidableCases = [
    ["斜めのタイル", 0],
    ["空白と行も列も違うタイル", 15],
    ["空白自体", 5],
    ["盤面の外", 16],
  ] as const;

  test.each(unslidableCases)(
    "成立しない操作では null を返すこと: %s",
    (_, tileIndex) => {
      const result = getSlidePuzzleSlide(board, tileIndex);

      expect(result).toBeNull();
    },
  );

  describe("3×3・5×5 の盤面の場合", () => {
    const slidableCases = [
      [
        "3×3 の左隣のタイル",
        threeByThreeBoard,
        3,
        { direction: "right", movedTileIndices: [3] },
      ],
      [
        "3×3 の下隣のタイル",
        threeByThreeBoard,
        7,
        { direction: "up", movedTileIndices: [7] },
      ],
      [
        "5×5 の同じ行の離れたタイル",
        fiveByFiveBoard,
        10,
        { direction: "right", movedTileIndices: [11, 10] },
      ],
      [
        "5×5 の同じ列の離れたタイル",
        fiveByFiveBoard,
        22,
        { direction: "up", movedTileIndices: [17, 22] },
      ],
    ] as const;

    test.each(slidableCases)(
      "盤面の一辺に合わせて空白までのタイルをまとめて動かすこと: %s",
      (_, target, tileIndex, expected) => {
        const result = getSlidePuzzleSlide(target, tileIndex);

        expect(result).toEqual(expected);
      },
    );

    const unslidableCases = [
      ["3×3 の斜めのタイル", threeByThreeBoard, 0],
      ["5×5 の斜めのタイル", fiveByFiveBoard, 24],
    ] as const;

    test.each(unslidableCases)(
      "成立しない操作では null を返すこと: %s",
      (_, target, tileIndex) => {
        const result = getSlidePuzzleSlide(target, tileIndex);

        expect(result).toBeNull();
      },
    );
  });
});

describe("applySlidePuzzleSlide", () => {
  const cases = [
    [
      "同じ行の一括スライド",
      { direction: "left", movedTileIndices: [6, 7] },
      [1, 2, 3, 4, 5, 6, 7, 0, 8, 9, 10, 11, 12, 13, 14, 15],
    ],
    [
      "同じ列の一括スライド",
      { direction: "up", movedTileIndices: [9, 13] },
      [1, 2, 3, 4, 5, 9, 6, 7, 8, 13, 10, 11, 12, 0, 14, 15],
    ],
  ] as const;

  test.each(cases)(
    "動くタイルを空白側へ 1 マスずつずらした盤面を返すこと: %s",
    (_, slide, expected) => {
      const result = applySlidePuzzleSlide(board, slide);

      expect(result).toEqual(expected);
    },
  );
});

describe("listSlidePuzzleSingleMoves", () => {
  const cases = [
    ["空白が盤面の内側", board, [1, 4, 6, 9]],
    [
      "空白が右下の角",
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0],
      [11, 14],
    ],
    [
      "空白が左端",
      [1, 2, 3, 4, 0, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      [0, 5, 8],
    ],
  ] as const;

  test.each(cases)(
    "空白に隣接するタイルのマスを返すこと: %s",
    (_, target, expected) => {
      const result = listSlidePuzzleSingleMoves(target);

      expect([...result].sort((left, right) => left - right)).toEqual(expected);
    },
  );

  describe("3×3・5×5 の盤面の場合", () => {
    const sizedCases = [
      ["3×3 の中央の空白", threeByThreeBoard, [1, 3, 5, 7]],
      ["5×5 の中央の空白", fiveByFiveBoard, [7, 11, 13, 17]],
      [
        "5×5 の右下の空白",
        Array.from({ length: 25 }, (_, index) => (index + 1) % 25),
        [19, 23],
      ],
    ] as const;

    test.each(sizedCases)(
      "空白に隣接するタイルのマスを返すこと: %s",
      (_, target, expected) => {
        const result = listSlidePuzzleSingleMoves(target);

        expect([...result].sort((left, right) => left - right)).toEqual(
          expected,
        );
      },
    );
  });
});

describe("getSlidePuzzleKeyboardSlide", () => {
  const leftEdgeBlankBoard = [
    1, 2, 3, 4, 0, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  ];
  const cases: readonly [
    string,
    readonly number[],
    SlidePuzzleDirection,
    ReturnType<typeof getSlidePuzzleKeyboardSlide>,
  ][] = [
    ["上", board, "up", { direction: "up", movedTileIndices: [9] }],
    ["下", board, "down", { direction: "down", movedTileIndices: [1] }],
    ["左", board, "left", { direction: "left", movedTileIndices: [6] }],
    ["右", board, "right", { direction: "right", movedTileIndices: [4] }],
    ["左端の空白へ右から入るタイルは無い", leftEdgeBlankBoard, "right", null],
  ];

  test.each(cases)(
    "押した方向へ空白の隣のタイルを 1 枚だけ動かすこと: %s",
    (_, target, direction, expected) => {
      const result = getSlidePuzzleKeyboardSlide(target, direction);

      expect(result).toEqual(expected);
    },
  );

  describe("3×3・5×5 の盤面の場合", () => {
    const sizedCases: readonly [
      string,
      readonly number[],
      SlidePuzzleDirection,
      ReturnType<typeof getSlidePuzzleKeyboardSlide>,
    ][] = [
      [
        "3×3 の上",
        threeByThreeBoard,
        "up",
        { direction: "up", movedTileIndices: [7] },
      ],
      [
        "5×5 の上",
        fiveByFiveBoard,
        "up",
        { direction: "up", movedTileIndices: [17] },
      ],
      [
        "5×5 の左",
        fiveByFiveBoard,
        "left",
        { direction: "left", movedTileIndices: [13] },
      ],
    ];

    test.each(sizedCases)(
      "押した方向へ空白の隣のタイルを 1 枚だけ動かすこと: %s",
      (_, target, direction, expected) => {
        const result = getSlidePuzzleKeyboardSlide(target, direction);

        expect(result).toEqual(expected);
      },
    );
  });
});

describe("isSolvableSlidePuzzleBoard", () => {
  const cases = [
    ["完成盤面", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0], true],
    ["空白を動かした盤面", board, true],
    [
      "14 と 15 を入れ替えた盤面",
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0],
      false,
    ],
    [
      "0〜15 の並べ替えではない盤面",
      [1, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0],
      false,
    ],
  ] as const;

  test.each(cases)(
    "完成盤面へ到達できるかを判定できること: %s",
    (_, target, expected) => {
      const result = isSolvableSlidePuzzleBoard(target);

      expect(result).toBe(expected);
    },
  );

  describe("3×3・5×5 の盤面の場合", () => {
    const sizedCases = [
      ["3×3 の完成盤面", [1, 2, 3, 4, 5, 6, 7, 8, 0], true],
      ["3×3 の空白を上へ動かした盤面", [1, 2, 3, 4, 5, 0, 7, 8, 6], true],
      ["3×3 の 7 と 8 を入れ替えた盤面", [1, 2, 3, 4, 5, 6, 8, 7, 0], false],
      ["5×5 の空白を中央へ動かした盤面", fiveByFiveBoard, true],
      [
        "5×5 の 23 と 24 を入れ替えた盤面",
        [
          1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
          21, 22, 24, 23, 0,
        ],
        false,
      ],
    ] as const;

    test.each(sizedCases)(
      "幅が奇数の盤面では転倒数の偶奇で到達できるかを判定すること: %s",
      (_, target, expected) => {
        const result = isSolvableSlidePuzzleBoard(target);

        expect(result).toBe(expected);
      },
    );
  });
});
