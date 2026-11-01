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
  const cases = [
    ["取り残しが無い道", [0, 1, 2], []],
    // 真ん中の列で左右に分かれ、両側に袋小路（2 と 3）が残る。
    ["盤面を左右に分けた道", [0, 1, 4, 7], [2, 3]],
    // 先端 2 からは 1 にしか入れず、1・6・8 は袋小路、6・7・8 は先端から届かない。
    ["袋小路と届かない領域を残した道", [0, 3, 4, 5, 2], [1, 6, 7, 8]],
    // 先端が行き止まりなら、行き止まりの印に任せる。
    ["先端が行き止まりの道", [0, 1, 4, 5, 2], []],
  ] as const;

  test.each(cases)(
    "取り残しのマスを、重ねずに番号順で挙げること: %s",
    (_, path, expected) => {
      const cells = listHitofudePuzzleStrandedCells(openBoard, path);

      expect(cells).toEqual(expected);
    },
  );
});
