import {
  listHitofudePuzzleStrandedCells,
  showsHitofudePuzzleStranding,
} from "@/games/hitofude-puzzle/play/stranding-notice";
import { parseHitofudePuzzleBoard } from "@/games/hitofude-puzzle/puzzle/board";

// 0 1 2
// 3 4 5
// 6 7 8
const openBoard = parseHitofudePuzzleBoard(["S . .", ". . .", ". . ."]);

describe("showsHitofudePuzzleStranding", () => {
  const cases = [
    ["1", true],
    ["2", true],
    ["3", false],
    ["4", false],
    ["5", false],
  ] as const;

  test.each(cases)(
    "レベル1〜2 だけ取り残しを知らせること: レベル%s",
    (difficulty, expected) => {
      const shows = showsHitofudePuzzleStranding(difficulty);

      expect(shows).toBe(expected);
    },
  );
});

describe("listHitofudePuzzleStrandedCells", () => {
  describe("終点が盤面から決まらない盤面の場合", () => {
    const cases = [
      ["取り残しが無い道", [0, 1, 2], []],
      // 真ん中の列で左右に分かれ、両側に袋小路（2 と 3）が残る。どちらも終点になりうるので両方挙げる。
      ["盤面を左右に分けた道", [0, 1, 4, 7], [2, 3]],
      // 先端 2 からは 1 にしか入れず、1・6・8 は袋小路、6・7・8 は先端から届かない。
      ["袋小路と届かない領域を残した道", [0, 3, 4, 5, 2], [1, 6, 7, 8]],
      // 先端が行き止まりなら、残りのマスはどれも通れない。
      ["先端が行き止まりの道", [0, 1, 4, 5, 2], [3, 6, 7, 8]],
    ] as const;

    test.each(cases)(
      "取り残しのマスを、重ねずに番号順で挙げること: %s",
      (_, path, expected) => {
        const cells = listHitofudePuzzleStrandedCells(openBoard, path);

        expect(cells).toEqual(expected);
      },
    );
  });

  describe("終点が盤面から決まる盤面の場合", () => {
    //  0  #  2  3
    //  4  5  6  7
    //  8  9 10 11
    // 12  # 14 15
    // 12 は通れる隣が 8 だけなので、終点になる。
    const board = parseHitofudePuzzleBoard([
      "S # . .",
      ". . . .",
      ". . . .",
      ". # . .",
    ]);
    const cases = [
      ["解の途中までの道", [0, 4, 5, 6], []],
      // 3・2 は先端 7 からしか入れない行き止まりの通路。終点 12 も袋小路だが、終点には付けない。
      ["終点のほかに袋小路を作った道", [0, 4, 5, 6, 7], [2, 3]],
      // 14・15 は先端 10 からしか入れず、入ると出られない。
      ["口が先端だけの領域を残した道", [0, 4, 5, 6, 2, 3, 7, 11, 10], [14, 15]],
      // 14・15 は先端から届かない。終点 12 はまだ届くので付けない。
      ["届かない領域を残した道", [0, 4, 5, 6, 2, 3, 7, 11, 10, 9], [14, 15]],
      // 終点 12 に届かなくなったら、終点を挙げる。
      ["終点に届かなくなった道", [0, 4, 8, 9, 5, 6, 2, 3, 7, 11, 10], [12]],
    ] as const;

    test.each(cases)(
      "取り残しのマスを、重ねずに番号順で挙げること: %s",
      (_, path, expected) => {
        const cells = listHitofudePuzzleStrandedCells(board, path);

        expect(cells).toEqual(expected);
      },
    );
  });
});
