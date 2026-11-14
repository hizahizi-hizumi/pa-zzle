import {
  _private,
  countZukanSheetColumns,
} from "@/app/game-home/GameHomeScreen/ZukanProblemSheet";

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

describe("getWideSquareSizePx", () => {
  const cases = [
    [200, 40],
    [250, 40],
    [251, 32],
    [500, 32],
    [501, 26],
    [1000, 26],
  ] as const;

  test.each(cases)(
    "%i問の台紙のマスを、最低 %ipx にすること",
    (problemCount, expected) => {
      const sizePx = _private.getWideSquareSizePx(problemCount);

      expect(sizePx).toBe(expected);
    },
  );
});

describe("getNarrowSquareSizePx", () => {
  const cases = [
    [200, 30],
    [250, 30],
    [251, 24],
    [1000, 24],
  ] as const;

  test.each(cases)(
    "%i問の台紙のマスを、最低 %ipx にすること",
    (problemCount, expected) => {
      const sizePx = _private.getNarrowSquareSizePx(problemCount);

      expect(sizePx).toBe(expected);
    },
  );
});

describe("countZukanSheetColumns", () => {
  describe("PC より狭い幅の場合", () => {
    const cases = [
      [334, 1000, 13],
      [334, 200, 11],
      [0, 10, 1],
    ] as const;

    test.each(cases)(
      "幅 %ipx に %i問の台紙を %i列で並べること",
      (widthPx, problemCount, expected) => {
        const columnCount = countZukanSheetColumns(widthPx, problemCount);

        expect(columnCount).toBe(expected);
      },
    );
  });

  describe("PC の幅の場合", () => {
    const cases = [
      [660, 1000, 25],
      [660, 500, 20],
      [660, 200, 16],
    ] as const;

    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(
          (query: string) =>
            ({ matches: query === "(width >= 64rem)" }) as MediaQueryList,
        ),
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    test.each(cases)(
      "幅 %ipx に %i問の台紙を %i列で並べること",
      (widthPx, problemCount, expected) => {
        const columnCount = countZukanSheetColumns(widthPx, problemCount);

        expect(columnCount).toBe(expected);
      },
    );
  });
});
