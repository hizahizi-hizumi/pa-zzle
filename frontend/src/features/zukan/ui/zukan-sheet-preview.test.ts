import { _private } from "@/features/zukan/ui/zukan-sheet-preview";

const { listPiecesInArea } = _private;

describe("listPiecesInArea", () => {
  const problemCount = 23;
  const columnCount = 5;

  test("範囲の行と列に、タブがはみ出してくる外側の1マスずつを加えたピースを番号の順に返すこと", () => {
    const positions = listPiecesInArea(problemCount, columnCount, {
      left: 2,
      top: 2,
      width: 1,
      height: 1,
    });

    expect(positions).toEqual([6, 7, 8, 11, 12, 13, 16, 17, 18]);
  });

  test("台紙の外と、末尾の問題より後のマスを含めないこと", () => {
    const positions = listPiecesInArea(problemCount, columnCount, {
      left: 0,
      top: 3.5,
      width: 5,
      height: 2,
    });

    expect(positions).toEqual([
      10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
    ]);
  });
});
