import { countReflectionSolutions } from "@/games/reflection/problem/generation/solver";
import {
  countReflectionBoardPieces,
  createEmptyReflectionInventory,
  parseReflectionBoard,
  type ReflectionBoard,
  type ReflectionCell,
  type ReflectionPiece,
} from "@/games/reflection/puzzle/board";
import { computeReflectionClues } from "@/games/reflection/puzzle/laser";

function toInput(board: ReflectionBoard) {
  return {
    size: board.size,
    inventory: countReflectionBoardPieces(board),
    clues: computeReflectionClues(board),
  };
}

/** 手持ちのピースを置く全配置を列挙する。同じ種類のピース同士の入れ替えは同じ配置として1回だけ数える。 */
function enumerateBoards(
  size: number,
  pieces: readonly ReflectionPiece[],
): ReflectionBoard[] {
  const boards: ReflectionBoard[] = [];
  const cells = new Array<ReflectionCell>(size * size).fill(null);
  function place(pieceIndex: number, minimumCellIndex: number): void {
    const piece = pieces[pieceIndex];
    if (piece === undefined) {
      boards.push({ size, cells: [...cells] });
      return;
    }
    const sameAsPrevious = pieceIndex > 0 && pieces[pieceIndex - 1] === piece;
    for (
      let cellIndex = sameAsPrevious ? minimumCellIndex : 0;
      cellIndex < cells.length;
      cellIndex += 1
    ) {
      if (cells[cellIndex] !== null) {
        continue;
      }
      cells[cellIndex] = piece;
      place(pieceIndex + 1, cellIndex + 1);
      cells[cellIndex] = null;
    }
  }
  place(0, 0);
  return boards;
}

/** 全配置を外周ヒントで分類し、各配置と同じヒントになる配置の数（2以上は2）を数える。 */
function countSolutionsByEnumeration(boards: readonly ReflectionBoard[]) {
  const boardCountByClues = new Map<string, number>();
  const clueKeys = boards.map(function toClueKey(board) {
    const key = JSON.stringify(computeReflectionClues(board));
    boardCountByClues.set(key, (boardCountByClues.get(key) ?? 0) + 1);
    return key;
  });
  return clueKeys.map((key) => Math.min(boardCountByClues.get(key) ?? 0, 2));
}

describe("countReflectionSolutions", () => {
  describe("全配置の列挙との照合", () => {
    const cases = (
      [
        ["斜め鏡2種と反射体", ["slash", "backslash", "reflector"]],
        [
          "両面鏡2種とブラックホール",
          ["vertical-double", "horizontal-double", "black-hole"],
        ],
        ["同じ種類を含む", ["slash", "slash", "vertical-double"]],
      ] as const
    ).map(function toCase([name, pieces]) {
      const boards = enumerateBoards(3, pieces);
      return [name, boards, countSolutionsByEnumeration(boards)] as const;
    });

    test.each(cases)(
      "%s の3×3の全配置で、解の数が列挙と一致すること",
      (_, boards, expected) => {
        const result = boards.map(
          (board) => countReflectionSolutions(toInput(board)).solutionCount,
        );

        expect(result).toEqual(expected);
      },
    );
  });

  describe("一意解の問題", () => {
    const board = parseReflectionBoard([
      ".....",
      ".../.",
      "|.|=.",
      "...@.",
      "\\....",
    ]);

    test("解を1つと数え、その配置を返すこと", () => {
      const result = countReflectionSolutions(toInput(board));

      expect(result).toEqual({
        status: "complete",
        solutionCount: 1,
        firstSolution: board,
      });
    });
  });

  describe("手持ちとヒントに合う配置が無い入力", () => {
    const emptyBoard = parseReflectionBoard(["...", "...", "..."]);
    const input = {
      ...toInput(emptyBoard),
      inventory: { ...createEmptyReflectionInventory(), reflector: 1 },
    };

    test("解を0と数えること", () => {
      const result = countReflectionSolutions(input);

      expect(result).toEqual({
        status: "complete",
        solutionCount: 0,
        firstSolution: null,
      });
    });
  });

  describe("光の届かないマスで2つのピースを入れ替えられる問題", () => {
    const input = toInput(
      parseReflectionBoard([".oo.", "o/\\o", ".oo.", "...."]),
    );

    test("2つ目の解を見つけて2と数えること", () => {
      const result = countReflectionSolutions(input);

      expect(result.solutionCount).toBe(2);
    });

    test("solutionLimit が 1 なら最初の解で打ち切ること", () => {
      const result = countReflectionSolutions(input, { solutionLimit: 1 });

      expect(result.solutionCount).toBe(1);
    });
  });

  describe("探索量の上限", () => {
    const board = parseReflectionBoard([
      "/..o...",
      "..\\....",
      ".|...@.",
      "....=..",
      ".o.....",
      "...\\..|",
      "=.....\\",
    ]);

    test("上限に達したら打ち切りを返すこと", () => {
      const result = countReflectionSolutions(toInput(board), {
        searchStepLimit: 1,
      });

      expect(result.status).toBe("search-limit-reached");
    });
  });
});
