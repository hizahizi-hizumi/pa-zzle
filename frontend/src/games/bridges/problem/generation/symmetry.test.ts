import {
  getBridgesLayoutKey,
  getBridgesSymmetryKey,
} from "@/games/bridges/problem/generation/symmetry";
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

describe("getBridgesLayoutKey", () => {
  const base = parseBridgesBoard(["2.3..", ".....", "1...2", ".....", "..4.1"]);

  test("数字だけが違う盤面に同じキーを返すこと", () => {
    const key = getBridgesLayoutKey(
      parseBridgesBoard(["1.5..", ".....", "2...2", ".....", "..2.3"]),
    );

    expect(key).toBe(getBridgesLayoutKey(base));
  });

  test("回転した盤面に同じキーを返すこと", () => {
    const key = getBridgesLayoutKey(
      parseBridgesBoard(["..1.2", ".....", "4...3", ".....", "1.2.."]),
    );

    expect(key).toBe(getBridgesLayoutKey(base));
  });

  test("島の位置が1つ違う盤面に違うキーを返すこと", () => {
    const key = getBridgesLayoutKey(
      parseBridgesBoard(["2.3..", ".....", "1...2", ".....", ".4..1"]),
    );

    expect(key).not.toBe(getBridgesLayoutKey(base));
  });
});
