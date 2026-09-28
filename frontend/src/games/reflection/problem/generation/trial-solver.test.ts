import {
  type ReflectionTrialSolveInput,
  type ReflectionTrialSolveTrace,
  traceReflectionTrialSolve,
} from "@/games/reflection/problem/generation/trial-solver";
import {
  countReflectionBoardPieces,
  parseReflectionBoard,
  type ReflectionBoard,
} from "@/games/reflection/puzzle/board";
import { computeReflectionClues } from "@/games/reflection/puzzle/laser";

function toInput(board: ReflectionBoard): ReflectionTrialSolveInput {
  return {
    size: board.size,
    inventory: countReflectionBoardPieces(board),
    clues: computeReflectionClues(board),
  };
}

function countMoveKinds({
  cleanFixCount,
  breakingFixCount,
  advanceCount,
  detourCount,
}: ReflectionTrialSolveTrace): number {
  return cleanFixCount + breakingFixCount + advanceCount + detourCount;
}

describe("traceReflectionTrialSolve", () => {
  // 生成器の版 2 の問題集にあった問題の解。
  const cases: readonly [string, ReflectionBoard, ReflectionTrialSolveTrace][] =
    [
      [
        "外周ヒントを1本ずつ、一致を崩さずに満たせる問題",
        parseReflectionBoard([".....", ".....", ".@...", ".....", "...@."]),
        {
          status: "solved",
          moveCount: 2,
          cleanFixCount: 2,
          breakingFixCount: 0,
          brokenMatchCount: 0,
          advanceCount: 0,
          detourCount: 0,
          retryCount: 0,
        },
      ],
      [
        "1本を満たすと別の1本の一致が崩れる問題",
        parseReflectionBoard(["\\....", "=....", ".....", ".....", "....."]),
        {
          status: "solved",
          moveCount: 2,
          cleanFixCount: 1,
          breakingFixCount: 1,
          brokenMatchCount: 1,
          advanceCount: 0,
          detourCount: 0,
          retryCount: 1,
        },
      ],
      [
        "外周ヒントが同じピースを取り合い、崩しながら解き切る問題",
        parseReflectionBoard([
          "./.\\o.",
          "......",
          "....o.",
          "|.....",
          "....=.",
          "./....",
        ]),
        {
          status: "solved",
          moveCount: 70,
          cleanFixCount: 9,
          breakingFixCount: 48,
          brokenMatchCount: 96,
          advanceCount: 13,
          detourCount: 0,
          retryCount: 48,
        },
      ],
      [
        "試し置きでは手数の上限までに解き切れない問題",
        parseReflectionBoard([
          "..\\..=",
          "...=..",
          "..\\\\..",
          ".|//o.",
          "......",
          ".\\\\...",
        ]),
        {
          status: "move-limit-reached",
          moveCount: 240,
          cleanFixCount: 33,
          breakingFixCount: 121,
          brokenMatchCount: 221,
          advanceCount: 23,
          detourCount: 63,
          retryCount: 184,
        },
      ],
    ];

  test.each(cases)("%s の経過を返すこと", (_, board, expected) => {
    const result = traceReflectionTrialSolve(toInput(board));

    expect(result).toEqual(expected);
  });

  test.each(cases)(
    "%s で、手数が手の種類ごとの数の合計になること",
    (_, board) => {
      const result = traceReflectionTrialSolve(toInput(board));

      expect(countMoveKinds(result)).toBe(result.moveCount);
      expect(result.retryCount).toBe(
        result.breakingFixCount + result.detourCount,
      );
    },
  );

  test("同じ入力には同じ結果を返すこと", () => {
    const input = toInput(cases[2]![1]);

    const first = traceReflectionTrialSolve(input);
    const second = traceReflectionTrialSolve(structuredClone(input));

    expect(second).toEqual(first);
  });

  test("外周ヒントが盤面の外周の数と合わない入力を拒むこと", () => {
    const input = toInput(cases[0]![1]);

    expect(() =>
      traceReflectionTrialSolve({ ...input, clues: input.clues.slice(1) }),
    ).toThrow(RangeError);
  });
});
