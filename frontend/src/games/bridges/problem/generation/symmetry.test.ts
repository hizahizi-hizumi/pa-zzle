import { getBridgesSymmetryKey } from "@/games/bridges/problem/generation/symmetry";
import { parseBridgesBoard } from "@/games/bridges/puzzle/board";

describe("getBridgesSymmetryKey", () => {
  const base = parseBridgesBoard(["2.3..", ".....", "1...2", ".....", "..4.1"]);
  const variants = [
    ["左右反転", ["..3.2", ".....", "2...1", ".....", "1.4.."]],
    ["上下反転", ["..4.1", ".....", "1...2", ".....", "2.3.."]],
    ["右へ90度回転", ["..1.2", ".....", "4...3", ".....", "1.2.."]],
    ["転置", ["2.1..", ".....", "3...4", ".....", "..2.1"]],
  ] as const;

  test.each(variants)("%sした盤面に同じキーを返すこと", (_, rows) => {
    const key = getBridgesSymmetryKey(parseBridgesBoard(rows));

    expect(key).toBe(getBridgesSymmetryKey(base));
  });

  describe("数字が1つ違う盤面の場合", () => {
    const changed = parseBridgesBoard([
      "2.3..",
      ".....",
      "1...2",
      ".....",
      "..4.2",
    ]);

    test("違うキーを返すこと", () => {
      const key = getBridgesSymmetryKey(changed);

      expect(key).not.toBe(getBridgesSymmetryKey(base));
    });
  });
});
