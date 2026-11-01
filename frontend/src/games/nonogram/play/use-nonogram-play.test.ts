import { act, cleanup, renderHook } from "@testing-library/react";

import { useNonogramPlay } from "@/games/nonogram/play/use-nonogram-play";
import { selectNonogramProblemForDifficulty } from "@/games/nonogram/problem-selection";
import type { NonogramPattern } from "@/games/nonogram/puzzle/pattern";
import { createProblemId } from "@/games/problem-id";
import { createProblemSeed } from "@/games/problem-seed";

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: vi.fn(),
}));

type HookResult = { current: ReturnType<typeof useNonogramPlay> };

const difficulty = "1";
const initialSeed = "use-nonogram-play-a";
const otherSeed = "use-nonogram-play-b";
const initial = selectNonogramProblemForDifficulty(difficulty, initialSeed);
const other = selectNonogramProblemForDifficulty(difficulty, otherSeed);
const { solution } = initial.problem;
const firstBlackCellIndex = solution.black.indexOf(true);

function listBlackCellIndices(pattern: NonogramPattern): number[] {
  return pattern.black.flatMap((isBlack, cellIndex) =>
    isBlack ? [cellIndex] : [],
  );
}

function tap(result: HookResult, cellIndex: number): void {
  act(() => result.current.startStroke(cellIndex, "filled"));
  act(() => result.current.endStroke());
}

function fillSolution(result: HookResult): void {
  for (const cellIndex of listBlackCellIndices(solution)) {
    tap(result, cellIndex);
  }
}

afterEach(() => {
  cleanup();
  vi.mocked(createProblemSeed).mockReset();
});

describe("useNonogramPlay", () => {
  describe("難易度だけを渡した場合", () => {
    let result: HookResult;

    beforeEach(() => {
      vi.mocked(createProblemSeed)
        .mockReturnValueOnce(initialSeed)
        .mockReturnValueOnce(otherSeed);
      ({ result } = renderHook(() => useNonogramPlay(difficulty)));
    });

    test("seed で選んだ問題の未確定の盤面とヒントでプレイを始めること", () => {
      const { board, clues, progress, problemIdentity } = result.current;

      expect(board.cells.every((state) => state === "unknown")).toBe(true);
      expect(clues).toEqual(initial.problem.clues);
      expect(progress).toBe("playing");
      expect(problemIdentity).toEqual(initial.identity);
    });

    describe("マスを押した場合", () => {
      beforeEach(() => {
        act(() => result.current.startStroke(firstBlackCellIndex, "filled"));
      });

      test("押している間は入力の範囲を返すこと", () => {
        const { strokeRange } = result.current;

        expect(strokeRange).toEqual({
          startCellIndex: firstBlackCellIndex,
          endCellIndex: firstBlackCellIndex,
        });
      });

      test("離すと入力を終え、待ったと盤面を戻すを使えるようにすること", () => {
        act(() => result.current.endStroke());

        expect(result.current.strokeRange).toBeNull();
        expect(result.current.board.cells[firstBlackCellIndex]).toBe("filled");
        expect(result.current.canUndo).toBe(true);
        expect(result.current.canRestart).toBe(true);
      });
    });

    describe("1行の塗りをすべて入れた場合", () => {
      const row = Math.floor(firstBlackCellIndex / solution.width);
      const rowCells = listBlackCellIndices(solution).filter(
        (cellIndex) => Math.floor(cellIndex / solution.width) === row,
      );

      beforeEach(() => {
        for (const cellIndex of rowCells) {
          tap(result, cellIndex);
        }
      });

      test("その行をヒントにちょうど合った行として返すこと", () => {
        const { matchedLines } = result.current;

        expect(matchedLines.rows[row]).toBe(true);
      });
    });

    describe("塗った後の場合", () => {
      beforeEach(() => {
        tap(result, firstBlackCellIndex);
      });

      test("待ったで直前の入力を取り消すこと", () => {
        act(() => result.current.undo());

        expect(result.current.board.cells[firstBlackCellIndex]).toBe("unknown");
        expect(result.current.canUndo).toBe(false);
      });
    });

    describe("塗りが図柄と一致した場合", () => {
      beforeEach(() => {
        fillSolution(result);
      });

      test("完成演出へ進み、経過時間を止め、評価を返さないこと", () => {
        const {
          progress,
          status,
          completedAt,
          result: playResult,
        } = result.current;

        expect(progress).toBe("clearing");
        expect(status).toBe("cleared");
        expect(completedAt).not.toBeNull();
        expect(playResult).toBeNull();
      });

      test("完成演出を終えても盤面を見せたままにすること", () => {
        act(() => result.current.completeClearAnimation());

        expect(result.current.progress).toBe("result");
        expect(result.current.board.cells[firstBlackCellIndex]).toBe("filled");
      });

      test("リセットで同じ問題を未確定の盤面から始め直すこと", () => {
        act(() => result.current.replay());

        expect(result.current.progress).toBe("playing");
        expect(result.current.problemIdentity).toEqual(initial.identity);
        expect(
          result.current.board.cells.every((state) => state === "unknown"),
        ).toBe(true);
      });
    });

    test("別の問題で、今の問題を避けて別の seed の問題を始めること", () => {
      act(() => result.current.startNewProblem());

      expect(createProblemId(result.current.problemIdentity)).not.toBe(
        createProblemId(initial.identity),
      );
      expect(result.current.problemIdentity).toEqual(other.identity);
    });
  });

  describe("始める問題を渡した場合", () => {
    let result: HookResult;

    beforeEach(() => {
      ({ result } = renderHook(() => useNonogramPlay(difficulty, other)));
    });

    test("seed を引かずにその問題でプレイを始めること", () => {
      const { problemIdentity, clues } = result.current;

      expect(createProblemSeed).not.toHaveBeenCalled();
      expect(problemIdentity).toEqual(other.identity);
      expect(clues).toEqual(other.problem.clues);
    });
  });

  describe("最初の seed が避ける問題を指す場合", () => {
    let result: HookResult;

    beforeEach(() => {
      vi.mocked(createProblemSeed)
        .mockReturnValueOnce(initialSeed)
        .mockReturnValueOnce(otherSeed);
      ({ result } = renderHook(() =>
        useNonogramPlay(
          difficulty,
          undefined,
          createProblemId(initial.identity),
        ),
      ));
    });

    test("seed を引き直して避ける問題とは別の問題で始めること", () => {
      const { problemIdentity } = result.current;

      expect(other.identity).not.toEqual(initial.identity);
      expect(problemIdentity).toEqual(other.identity);
    });
  });
});
