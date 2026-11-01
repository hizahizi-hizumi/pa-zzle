import { difficultyLevels } from "@/games/difficulty";
import {
  listHitofudePuzzleStalls,
  measureHitofudePuzzleLookaheadLoad,
} from "@/games/hitofude-puzzle/problem/generation/human-solver";
import { selectHitofudePuzzlePreviewProblem } from "@/games/hitofude-puzzle/problem-selection";
import {
  getHitofudePuzzleCellPosition,
  listHitofudePuzzleOpenCells,
} from "@/games/hitofude-puzzle/puzzle/board";
import { placeHitofudePuzzleThinkingMarks } from "@/games/hitofude-puzzle/ui/HitofudePuzzleDifficultyPreview/thinking-marks";

const previews = difficultyLevels.map(({ id }) => {
  const board = selectHitofudePuzzlePreviewProblem(id);
  return {
    difficulty: id,
    board,
    marks: placeHitofudePuzzleThinkingMarks(board),
  };
});

describe("placeHitofudePuzzleThinkingMarks", () => {
  describe.each(previews)(
    "レベル $difficulty の見本の盤面の場合",
    ({ board, marks }) => {
      test("局所の推論で止まった局面ごとに1つ、長い先読みにはその重さだけ印を足して置くこと", () => {
        const expected = listHitofudePuzzleStalls(board).reduce(
          (sum, { refutationLength }) =>
            sum + measureHitofudePuzzleLookaheadLoad(1, refutationLength),
          0,
        );

        expect(marks).toHaveLength(expected);
      });

      test("印を、通れる別々のマスで、隣り合わず、盤面の端の行・列と始点から離して置くこと", () => {
        const openCells = new Set(listHitofudePuzzleOpenCells(board));
        const positions = [...marks, board.start].map((cell) =>
          getHitofudePuzzleCellPosition(board.size, cell),
        );

        for (const [index, cell] of marks.entries()) {
          const { row, column } = positions[index]!;
          expect(openCells.has(cell)).toBe(true);
          expect(
            [row, column].every((value) => value > 0 && value < board.size - 1),
          ).toBe(true);
          for (const other of positions.slice(index + 1)) {
            expect(
              Math.max(
                Math.abs(row - other.row),
                Math.abs(column - other.column),
              ),
            ).toBeGreaterThanOrEqual(2);
          }
        }
      });
    },
  );

  test("局所の推論だけで道が決まるレベル1 の見本には、印を置かないこと", () => {
    expect(previews[0]!.marks).toEqual([]);
  });

  test("上のレベルの見本ほど、考えどころの印が多いこと", () => {
    const counts = previews.map(({ marks }) => marks.length);

    for (const [index, count] of counts.slice(1).entries()) {
      expect(count).toBeGreaterThan(counts[index]!);
    }
  });
});
