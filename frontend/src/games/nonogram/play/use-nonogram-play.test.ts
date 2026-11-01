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

  test("押している間は入力の範囲を返し、離すと入力を終えること", () => {
    act(() => result.current.startStroke(firstBlackCellIndex, "filled"));
    const pressedRange = result.current.strokeRange;
    act(() => result.current.endStroke());

    expect(pressedRange).toEqual({
      startCellIndex: firstBlackCellIndex,
      endCellIndex: firstBlackCellIndex,
    });
    expect(result.current.strokeRange).toBeNull();
    expect(result.current.board.cells[firstBlackCellIndex]).toBe("filled");
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRestart).toBe(true);
  });

  test("塗りがヒントにちょうど合った行・列を返すこと", () => {
    const row = Math.floor(firstBlackCellIndex / solution.width);
    const rowCells = listBlackCellIndices(solution).filter(
      (cellIndex) => Math.floor(cellIndex / solution.width) === row,
    );
    for (const cellIndex of rowCells) {
      tap(result, cellIndex);
    }

    expect(result.current.matchedLines.rows[row]).toBe(true);
  });

  test("待ったで直前の入力を取り消すこと", () => {
    tap(result, firstBlackCellIndex);
    act(() => result.current.undo());

    expect(result.current.board.cells[firstBlackCellIndex]).toBe("unknown");
    expect(result.current.canUndo).toBe(false);
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
