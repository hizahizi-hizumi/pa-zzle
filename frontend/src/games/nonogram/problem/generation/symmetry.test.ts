import { getNonogramSymmetryKey } from "@/games/nonogram/problem/generation/symmetry";
import { parseNonogramPattern } from "@/games/nonogram/puzzle/pattern";

function reverseText(text: string): string {
  return Array.from(text).reverse().join("");
}

function mirrorLeftRight(rows: readonly string[]): string[] {
  return rows.map(reverseText);
}

function flipUpDown(rows: readonly string[]): string[] {
  return [...rows].reverse();
}

function rotateClockwise(rows: readonly string[]): string[] {
  const height = rows.length;
  return Array.from(rows[0] ?? "", (_, column) =>
    Array.from(
      { length: height },
      (_, row) => rows[height - 1 - row]![column],
    ).join(""),
  );
}

describe("getNonogramSymmetryKey", () => {
  describe("研究用 Python の正規化キーとの照合", () => {
    // scripts/research/nonogram_core.py の canonical_key が返したキー。
    const cases = [
      {
        name: "7×7（候補 2）",
        pattern: [
          "...#...",
          "#######",
          "###.###",
          "##.#.##",
          "#.#.#.#",
          ".#...#.",
          ".##.##.",
        ],
        key: "0001000/1111111/1110111/1101011/1010101/0100010/0110110",
      },
      {
        name: "9×9（候補 8）",
        pattern: [
          ".#######.",
          "#.##.##.#",
          "...#.#...",
          "...###...",
          "##.#.#.##",
          ".###.###.",
          ".#.###.#.",
          "###.#.###",
          "#.#.#.#.#",
        ],
        key: "010010011/100011110/110001011/111111100/100100111/111111100/110001011/100011110/010010011",
      },
      {
        name: "10×10（候補 14）",
        pattern: [
          "###....###",
          "####..####",
          ".########.",
          "...####...",
          "....##....",
          "....##....",
          "##......##",
          "##......##",
          "##......##",
          "##......##",
        ],
        key: "1100000011/1100000011/1100000011/1100000011/0000110000/0000110000/0001111000/0111111110/1111001111/1110000111",
      },
      {
        name: "10×12（候補 18）",
        pattern: [
          "...##..#..",
          "..######..",
          "#.#######.",
          ".#########",
          "###....###",
          "###...####",
          "###....##.",
          "##....###.",
          "##....###.",
          "......####",
          ".##...####",
          ".##..#####",
        ],
        key: "0001100100/0011111100/1011111110/0111111111/1110000111/1110001111/1110000110/1100001110/1100001110/0000001111/0110001111/0110011111",
      },
    ];

    test.each(cases)("$name で、同じキーを返すこと", ({ pattern, key }) => {
      const symmetryKey = getNonogramSymmetryKey(parseNonogramPattern(pattern));

      expect(symmetryKey).toBe(key);
    });
  });

  describe("正方形の図柄の場合", () => {
    const rows = ["##..", "#...", "..#.", "...."];
    const variants = [
      rows,
      mirrorLeftRight(rows),
      flipUpDown(rows),
      rotateClockwise(rows),
      rotateClockwise(rotateClockwise(rows)),
      rotateClockwise(rotateClockwise(rotateClockwise(rows))),
      rotateClockwise(mirrorLeftRight(rows)),
      mirrorLeftRight(rotateClockwise(rows)),
    ];

    test("回転・反転した8通りの図柄に同じキーを返すこと", () => {
      const keys = variants.map((variant) =>
        getNonogramSymmetryKey(parseNonogramPattern(variant)),
      );

      expect(new Set(keys).size).toBe(1);
    });
  });

  describe("縦長の図柄の場合", () => {
    const rows = ["##.", "#..", "...", "..#"];
    const variants = [
      rows,
      mirrorLeftRight(rows),
      flipUpDown(rows),
      flipUpDown(mirrorLeftRight(rows)),
    ];

    test("上下・左右の反転と180度の回転に同じキーを返すこと", () => {
      const keys = variants.map((variant) =>
        getNonogramSymmetryKey(parseNonogramPattern(variant)),
      );

      expect(new Set(keys).size).toBe(1);
    });
  });

  describe("回転・反転で重ならない図柄の場合", () => {
    const first = parseNonogramPattern(["##.", "#..", "..."]);
    const second = parseNonogramPattern(["##.", "...", "#.."]);

    test("違うキーを返すこと", () => {
      const firstKey = getNonogramSymmetryKey(first);
      const secondKey = getNonogramSymmetryKey(second);

      expect(firstKey).not.toBe(secondKey);
    });
  });

  describe("角の1マスだけが黒い 3×3 の図柄の場合", () => {
    const rows = ["..#", "...", "..."];

    test("各行を1と0の列にして / でつないだ同型のうち辞書順で最小のものを返すこと", () => {
      const symmetryKey = getNonogramSymmetryKey(parseNonogramPattern(rows));

      expect(symmetryKey).toBe("000/000/001");
    });
  });
});
