import {
  countReflectionBoardPieces,
  parseReflectionBoard,
} from "@/games/reflection/puzzle/board";
import { computeReflectionClues } from "@/games/reflection/puzzle/laser";
import { isReflectionSolved } from "@/games/reflection/puzzle/rules";

describe("isReflectionSolved", () => {
  const solution = parseReflectionBoard(["...", "./.", "..@"]);
  const target = {
    inventory: countReflectionBoardPieces(solution),
    clues: computeReflectionClues(solution),
  };
  const cases = [
    ["正解配置", ["...", "./.", "..@"], true],
    ["ピースを置き切っていない盤面", ["...", "./.", "..."], false],
    ["ヒントが揃わない盤面", ["/..", "...", "..@"], false],
    ["手持ちに無いピースを置いた盤面", ["o..", "./.", "..@"], false],
  ] as const;

  test.each(cases)("%s のクリアを判定すること", (_, rows, expected) => {
    const result = isReflectionSolved(parseReflectionBoard(rows), target);

    expect(result).toBe(expected);
  });
});
