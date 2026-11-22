import { _private } from "@/views/PuzzleSelectionView/GameSelectionGallery/GameSelectionCarousel/GameSelectionSlide/FramedSheetCanvas";

const { listRowBands } = _private;

describe("listRowBands", () => {
  const preview = { columnCount: 4, rowCount: 30, firstRow: 12 };

  test("初めに見せる所とその上下に額の4分の1ずつを先に、残りの行を上から8行ずつ並べること", () => {
    const bands = listRowBands(preview);

    expect(bands).toEqual([
      { start: 11, end: 17 },
      { start: 0, end: 8 },
      { start: 8, end: 11 },
      { start: 17, end: 25 },
      { start: 25, end: 30 },
    ]);
  });
});
