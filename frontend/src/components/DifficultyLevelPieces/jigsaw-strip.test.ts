import { createJigsawStrip } from "@/components/DifficultyLevelPieces/jigsaw-strip";

describe("createJigsawStrip", () => {
  test("1マスの辺の長さから、5マスぶんの幅と上の凸を収める高さを持つ帯を作ること", () => {
    const strip = createJigsawStrip(16);

    expect(strip.width).toBe(80);
    expect(strip.height).toBe(22);
    expect(strip.cells).toHaveLength(5);
    expect(strip.seams).toHaveLength(4);
  });

  test("マスの境目と帯の外形が整数の座標に乗ること", () => {
    const strip = createJigsawStrip(20);

    for (const [index, cell] of strip.cells.entries()) {
      expect(cell).toMatch(new RegExp(`^M${index * 20} 7L`));
    }
    expect(strip.cells.at(-1)).toContain("L100 27L80 27");
  });
});
