import {
  getIslandOutlinePath,
  ISLAND_OUTLINE_WOBBLE,
  listIslandOutlineScales,
} from "@/games/bridges/ui/board/island-shape";

describe("listIslandOutlineScales", () => {
  test("どの島の輪郭も、半径の揺れが決めた幅に収まること", () => {
    const scales = Array.from({ length: 10 }, (_, row) =>
      Array.from({ length: 10 }, (_, column) =>
        listIslandOutlineScales({ row, column, clue: 1 }),
      ),
    ).flat(2);

    expect(Math.min(...scales)).toBeGreaterThanOrEqual(
      1 - ISLAND_OUTLINE_WOBBLE,
    );
    expect(Math.max(...scales)).toBeLessThanOrEqual(1 + ISLAND_OUTLINE_WOBBLE);
  });

  test("隣の島とは輪郭の揺れ方が違うこと", () => {
    const left = listIslandOutlineScales({ row: 3, column: 2, clue: 2 });
    const right = listIslandOutlineScales({ row: 3, column: 4, clue: 2 });

    expect(left).not.toEqual(right);
  });
});

describe("getIslandOutlinePath", () => {
  test("同じ島はいつも同じ輪郭になり、数字によらないこと", () => {
    const first = getIslandOutlinePath(
      { row: 1, column: 5, clue: 2 },
      { x: 5.9, y: 1.9 },
      0.44,
    );
    const second = getIslandOutlinePath(
      { row: 1, column: 5, clue: 6 },
      { x: 5.9, y: 1.9 },
      0.44,
    );

    expect(first).toBe(second);
  });
});
