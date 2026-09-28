import { doAllReflectionPiecesInfluenceClues } from "@/games/reflection/problem/generation/piece-influence";
import { parseReflectionBoard } from "@/games/reflection/puzzle/board";

describe("doAllReflectionPiecesInfluenceClues", () => {
  const cases = [
    ["どのピースも外周から光が届く盤面", [".o.", "o.o", ".o."], true],
    [
      "反射体に囲まれて光が届かないピースがある盤面",
      [".o.", "o/o", ".o."],
      false,
    ],
    ["ピースの無い盤面", ["...", "...", "..."], true],
  ] as const;

  test.each(cases)("%s を判定すること", (_, rows, expected) => {
    const result = doAllReflectionPiecesInfluenceClues(
      parseReflectionBoard(rows),
    );

    expect(result).toBe(expected);
  });
});
