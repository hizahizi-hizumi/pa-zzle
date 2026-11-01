import { _private } from "@/zukan/ui/GameZukanScreen/ZukanProblemSheet";

const { findNextSquareIndex } = _private;

describe("findNextSquareIndex", () => {
  const squareCount = 23;
  const columnCount = 10;
  const cases = [
    ["ArrowRight", 4, 5],
    ["ArrowLeft", 4, 3],
    ["ArrowDown", 4, 14],
    ["ArrowUp", 14, 4],
    ["ArrowLeft", 0, 0],
    ["ArrowRight", 22, 22],
    ["ArrowUp", 4, 4],
    ["ArrowDown", 15, 15],
    ["Home", 14, 0],
    ["End", 4, 22],
  ] as const;

  test.each(cases)(
    "%s を位置 %i で押すと位置 %i へ移ること",
    (key, index, expected) => {
      const nextIndex = findNextSquareIndex(
        key,
        index,
        squareCount,
        columnCount,
      );

      expect(nextIndex).toBe(expected);
    },
  );

  test("台紙の中を動くキーでなければ、移る先を返さないこと", () => {
    const nextIndex = findNextSquareIndex("Enter", 4, squareCount, columnCount);

    expect(nextIndex).toBeNull();
  });
});
