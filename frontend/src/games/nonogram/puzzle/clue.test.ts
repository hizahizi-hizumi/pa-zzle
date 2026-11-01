import {
  areSameNonogramClues,
  computeNonogramClues,
  computeNonogramLineClue,
} from "@/games/nonogram/puzzle/clue";
import { parseNonogramPattern } from "@/games/nonogram/puzzle/pattern";

function toBlack(notation: string): boolean[] {
  return Array.from(notation, (symbol) => symbol === "#");
}

describe("computeNonogramLineClue", () => {
  const cases = [
    ["......", []],
    ["######", [6]],
    ["#.##..", [1, 2]],
    [".#.#.#", [1, 1, 1]],
    ["##...#", [2, 1]],
  ] as const;

  test.each(cases)(
    "%s の黒の塊の長さを順に並べること",
    (notation, expected) => {
      const clue = computeNonogramLineClue(toBlack(notation));

      expect(clue).toEqual(expected);
    },
  );
});

describe("computeNonogramClues", () => {
  const pattern = parseNonogramPattern(["##.#", "....", "#.##"]);

  test("行ヒントを上から、列ヒントを左から並べること", () => {
    const clues = computeNonogramClues(pattern);

    expect(clues).toEqual({
      rows: [[2, 1], [], [1, 2]],
      columns: [[1, 1], [1], [1], [1, 1]],
    });
  });
});

describe("areSameNonogramClues", () => {
  const clues = computeNonogramClues(parseNonogramPattern(["#.", "##"]));
  const cases = [
    ["同じヒント", { rows: [[1], [2]], columns: [[2], [1]] }, true],
    ["塊の長さが違う", { rows: [[1], [2]], columns: [[2], [2]] }, false],
    ["塊の数が違う", { rows: [[1], [1, 1]], columns: [[2], [1]] }, false],
    ["列の数が違う", { rows: [[1], [2]], columns: [[2]] }, false],
  ] as const;

  test.each(cases)("%s を比べること", (_, other, expected) => {
    const same = areSameNonogramClues(clues, other);

    expect(same).toBe(expected);
  });
});
