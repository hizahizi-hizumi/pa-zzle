import { listNonogramClueNumbers } from "@/games/nonogram/ui/clue-numbers";

describe("listNonogramClueNumbers", () => {
  const cases = [
    ["黒の無い行・列", [], [0]],
    ["塊のある行・列", [3, 1], [3, 1]],
  ] as const;

  test.each(cases)(
    "%sのヒントを見せる数字の並びにすること",
    (_, clue, expected) => {
      const numbers = listNonogramClueNumbers(clue);

      expect(numbers).toEqual(expected);
    },
  );
});
