import {
  countZukanSheetColumns,
  estimateZukanSheetWidthPx,
  getNarrowZukanSquareSizePx,
  getWideZukanSquareSizePx,
} from "@/zukan/ui/zukan-sheet-layout";

describe("getWideZukanSquareSizePx", () => {
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
      const sizePx = getWideZukanSquareSizePx(problemCount);

      expect(sizePx).toBe(expected);
    },
  );
});

describe("getNarrowZukanSquareSizePx", () => {
  const cases = [
    [200, 30],
    [250, 30],
    [251, 24],
    [1000, 24],
  ] as const;

  test.each(cases)(
    "%i問の台紙のマスを、最低 %ipx にすること",
    (problemCount, expected) => {
      const sizePx = getNarrowZukanSquareSizePx(problemCount);

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

describe("estimateZukanSheetWidthPx", () => {
  const cases = [
    [390, 342],
    [639, 591],
    [640, 568],
    [1023, 951],
    [1024, 664],
    [1920, 664],
  ] as const;

  test.each(cases)(
    "画面幅 %ipx の台紙の幅を %ipx と求めること",
    (viewportWidthPx, expected) => {
      const widthPx = estimateZukanSheetWidthPx(viewportWidthPx);

      expect(widthPx).toBe(expected);
    },
  );
});
