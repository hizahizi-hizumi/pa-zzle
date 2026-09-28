import {
  countReflectionBoardPieces,
  parseReflectionBoard,
} from "@/games/reflection/puzzle/board";
import { computeReflectionClues } from "@/games/reflection/puzzle/laser";
import {
  isReflectionSolved,
  listReflectionClueMatches,
} from "@/games/reflection/puzzle/rules";

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

describe("listReflectionClueMatches", () => {
  // 外周ヒントの並びは 上0-2・右0-2・下0-2・左0-2。
  // 目標: 上 退出1・退出3・吸収3 / 右 退出5・退出3・吸収1 / 下 退出5・退出3・吸収1 / 左 退出1・退出3・吸収3
  const solution = parseReflectionBoard(["/..", "...", "..@"]);
  const clues = computeReflectionClues(solution);

  test("正解配置では全外周ヒントが一致すること", () => {
    const matches = listReflectionClueMatches(solution, clues);

    expect(matches).toEqual(Array(12).fill(true));
  });

  test("空の盤面では、まっすぐ抜ける光と同じ外周ヒントだけが一致すること", () => {
    const matches = listReflectionClueMatches(
      parseReflectionBoard(["...", "...", "..."]),
      clues,
    );

    expect(matches).toEqual([
      false,
      true,
      false,
      false,
      true,
      false,
      false,
      true,
      false,
      false,
      true,
      false,
    ]);
  });

  test("行き先が同じでも通るマスの数が違う外周ヒントは一致としないこと", () => {
    // ブラックホールだけを置くと、上0は「退出3」になり、目標の「退出1」と数が合わない。
    const matches = listReflectionClueMatches(
      parseReflectionBoard(["...", "...", "..@"]),
      clues,
    );

    expect(matches).toEqual([
      false,
      true,
      true,
      false,
      true,
      true,
      false,
      true,
      true,
      false,
      true,
      true,
    ]);
  });
});
