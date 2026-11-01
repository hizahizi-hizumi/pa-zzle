import { _private } from "@/zukan/ui/GameZukanScreen/ZukanProblemSheet";

const { findNextSquareIndex } = _private;

describe("findNextSquareIndex", () => {
  describe("絞り込んでいない台紙の場合", () => {
    const squareCount = 23;
    const columnCount = 10;
    const cases = [
      ["ArrowRight", 4, 5],
      ["ArrowLeft", 4, 3],
      ["ArrowRight", 9, 10],
      ["ArrowLeft", 10, 9],
      ["ArrowDown", 4, 14],
      ["ArrowUp", 14, 4],
      ["ArrowLeft", 0, 0],
      ["ArrowRight", 22, 22],
      ["ArrowUp", 4, 4],
      ["ArrowDown", 22, 22],
      ["ArrowDown", 15, 22],
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
          squareCount,
        );

        expect(nextIndex).toBe(expected);
      },
    );

    test("台紙の中を動くキーでなければ、移る先を返さないこと", () => {
      const nextIndex = findNextSquareIndex(
        "Enter",
        4,
        squareCount,
        columnCount,
        squareCount,
      );

      expect(nextIndex).toBeNull();
    });
  });

  describe("絞り込んで、当たった問題を前に、当たらなかった問題を行を改めて後ろに並べた台紙の場合", () => {
    // 当たった問題は位置 0〜11（2行目は2マス）、当たらなかった問題は位置 12〜34 で、行の頭から並ぶ。
    const squareCount = 35;
    const columnCount = 10;
    const matchedCount = 12;
    const cases = [
      ["ArrowDown", 1, 11],
      ["ArrowDown", 5, 11],
      ["ArrowDown", 11, 13],
      ["ArrowDown", 10, 12],
      ["ArrowUp", 12, 10],
      ["ArrowUp", 17, 11],
      ["ArrowDown", 17, 27],
      ["ArrowRight", 11, 12],
      ["ArrowLeft", 12, 11],
      ["End", 0, 34],
    ] as const;

    test.each(cases)(
      "%s を位置 %i で押すと、見えている行の並びに沿って位置 %i へ移ること",
      (key, index, expected) => {
        const nextIndex = findNextSquareIndex(
          key,
          index,
          squareCount,
          columnCount,
          matchedCount,
        );

        expect(nextIndex).toBe(expected);
      },
    );
  });

  describe("絞り込んで当たった問題が無い台紙の場合", () => {
    const squareCount = 15;
    const columnCount = 10;
    const matchedCount = 0;
    const cases = [
      ["ArrowUp", 3, 3],
      ["ArrowDown", 3, 13],
      ["Home", 9, 0],
    ] as const;

    test.each(cases)(
      "%s を位置 %i で押すと位置 %i へ移ること",
      (key, index, expected) => {
        const nextIndex = findNextSquareIndex(
          key,
          index,
          squareCount,
          columnCount,
          matchedCount,
        );

        expect(nextIndex).toBe(expected);
      },
    );
  });
});
