import { listTakuzuStrokeCellIndices } from "@/games/takuzu/ui/board/TakuzuBoard/stroke-path";

describe("listTakuzuStrokeCellIndices", () => {
  const cases = [
    ["隣のマスへ動いた", 0, 1, [1]],
    ["行の中で3マス先へ飛んだ", 6, 9, [7, 8, 9]],
    ["列の中で2マス下へ飛んだ", 1, 13, [7, 13]],
    ["同じマスに留まった", 4, 4, []],
  ] as const;

  test.each(cases)("通ったマスを順に返すこと: %s", (_, from, to, expected) => {
    const cellIndices = listTakuzuStrokeCellIndices(6, from, to);

    expect(cellIndices).toEqual(expected);
  });
});
