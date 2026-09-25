import { takuzuFixedProblem } from "@/games/takuzu/problem/fixed-problem";
import { assertTakuzuProblem } from "@/games/takuzu/problem/problem";
import {
  getTakuzuLineCellIndices,
  getTakuzuLineCells,
  listTakuzuLines,
  type TakuzuBoard,
  type TakuzuCell,
  type TakuzuLine,
  type TakuzuTile,
} from "@/games/takuzu/puzzle/board";

function listLegalLinePatterns(size: number): TakuzuTile[][] {
  let patterns: TakuzuTile[][] = [[]];
  for (let position = 0; position < size; position += 1) {
    patterns = patterns.flatMap((pattern) =>
      (["a", "b"] as const).map((tile) => [...pattern, tile]),
    );
  }
  return patterns.filter(
    (pattern) =>
      pattern.filter((tile) => tile === "a").length === size / 2 &&
      pattern.every(
        (tile, position) =>
          position < 2 ||
          tile !== pattern[position - 1] ||
          tile !== pattern[position - 2],
      ),
  );
}

function listCompletedOtherLinePatterns(
  board: TakuzuBoard,
  line: TakuzuLine,
): string[] {
  return listTakuzuLines(board.size)
    .filter((other) => other.axis === line.axis && other.index !== line.index)
    .map((other) => getTakuzuLineCells(board, other))
    .filter((cells) => cells.every((cell) => cell !== null))
    .map((cells) => cells.join(""));
}

/**
 * 1本の行・列だけを読む推論（隣接・挟み、個数、残り1個、重複回避、一般の行候補）を、
 * 何も確定しなくなるまで繰り返す。推論はどれも健全なので、解き切れればその解は唯一で、推測も要らない。
 */
function solveByLineDeduction(givens: TakuzuBoard): TakuzuBoard | null {
  const legalPatterns = listLegalLinePatterns(givens.size);
  const cells: TakuzuCell[] = [...givens.cells];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const line of listTakuzuLines(givens.size)) {
      const board = { size: givens.size, cells };
      const lineCells = getTakuzuLineCells(board, line);
      const completedOthers = listCompletedOtherLinePatterns(board, line);
      const candidates = legalPatterns.filter(
        (pattern) =>
          pattern.every(
            (tile, position) =>
              lineCells[position] === null || lineCells[position] === tile,
          ) && !completedOthers.includes(pattern.join("")),
      );
      const [firstCandidate] = candidates;
      if (!firstCandidate) {
        return null;
      }
      getTakuzuLineCellIndices(givens.size, line).forEach(
        (cellIndex, position) => {
          const tile = firstCandidate[position];
          const determined = candidates.every(
            (candidate) => candidate[position] === tile,
          );
          if (cells[cellIndex] === null && determined && tile) {
            cells[cellIndex] = tile;
            progressed = true;
          }
        },
      );
    }
  }
  return { size: givens.size, cells };
}

describe("takuzuFixedProblem", () => {
  test("8×8 の問題として成立していること", () => {
    const act = () => assertTakuzuProblem(takuzuFixedProblem);

    expect(act).not.toThrow();
    expect(takuzuFixedProblem.givens.size).toBe(8);
  });

  test("1本の行・列を読む推論だけで解と同じ盤面まで解き切れること", () => {
    const result = solveByLineDeduction(takuzuFixedProblem.givens);

    expect(result?.cells).toEqual(takuzuFixedProblem.solution.cells);
  });
});
