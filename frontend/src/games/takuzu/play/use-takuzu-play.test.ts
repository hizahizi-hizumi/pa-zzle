import { act, cleanup, renderHook } from "@testing-library/react";

import { createProblemSeed } from "@/games/problem-seed";
import { useTakuzuPlay } from "@/games/takuzu/play/use-takuzu-play";
import type { TakuzuProblem } from "@/games/takuzu/problem/problem";
import { selectTakuzuProblemForDifficulty } from "@/games/takuzu/problem-selection";

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: vi.fn(),
}));

type HookResult = { current: ReturnType<typeof useTakuzuPlay> };

const difficulty = "3";
const initialSeed = "use-takuzu-play-a";
const otherSeed = "use-takuzu-play-b";
const initial = selectTakuzuProblemForDifficulty(difficulty, initialSeed);
const other = selectTakuzuProblemForDifficulty(difficulty, otherSeed);
const firstEmptyCellIndex = initial.problem.givens.cells.indexOf(null);

/** 解のタイルになるまで各空きマスを押す手順。A は1回、B は2回押す。 */
function listSolvingPresses({ givens, solution }: TakuzuProblem): number[] {
  return givens.cells.flatMap((cell, cellIndex) => {
    if (cell !== null) {
      return [];
    }
    return solution.cells[cellIndex] === "a"
      ? [cellIndex]
      : [cellIndex, cellIndex];
  });
}

function pressAll(result: HookResult, cellIndices: readonly number[]): void {
  for (const cellIndex of cellIndices) {
    act(() => result.current.cycleCell(cellIndex, "forward"));
  }
}

function listCells(result: HookResult) {
  return result.current.cells.map(({ cell }) => cell);
}

afterEach(() => {
  cleanup();
  vi.mocked(createProblemSeed).mockReset();
});

describe("useTakuzuPlay", () => {
  let result: HookResult;

  beforeEach(() => {
    vi.mocked(createProblemSeed).mockReturnValueOnce(initialSeed);
    ({ result } = renderHook(() => useTakuzuPlay(difficulty)));
  });

  test("seed で問題集から選んだ問題の 8×8 盤面でプレイを始めること", () => {
    const { size, cells, progress, seed, problemIdentity } = result.current;

    expect(size).toBe(8);
    expect(cells.map(({ cell }) => cell)).toEqual(initial.problem.givens.cells);
    expect(progress).toBe("playing");
    expect(result.current.difficulty).toBe(difficulty);
    expect(seed).toBe(initialSeed);
    expect(problemIdentity).toEqual(initial.identity);
  });

  test("空きマスを押すとタイルを置くこと", () => {
    act(() => result.current.cycleCell(firstEmptyCellIndex, "forward"));

    expect(result.current.cells[firstEmptyCellIndex]?.cell).toBe("a");
  });

  test("空きマスへタイルを直接置けること", () => {
    act(() => result.current.placeCell(firstEmptyCellIndex, "b"));

    expect(result.current.cells[firstEmptyCellIndex]?.cell).toBe("b");
  });

  describe("空きマスへタイルを置いた場合", () => {
    beforeEach(() => {
      act(() => result.current.cycleCell(firstEmptyCellIndex, "forward"));
    });

    test("やり直すと初期配置へ戻すこと", () => {
      act(() => result.current.restart());

      expect(result.current.cells[firstEmptyCellIndex]?.cell).toBeNull();
    });

    test("リセットで同じ問題を初期配置から始めること", () => {
      act(() => result.current.replay());

      expect(listCells(result)).toEqual(initial.problem.givens.cells);
      expect(result.current.seed).toBe(initialSeed);
      expect(result.current.problemIdentity).toEqual(initial.identity);
    });
  });

  describe("全マスを解のとおりに置いた場合", () => {
    const solvingPresses = listSolvingPresses(initial.problem);

    beforeEach(() => {
      pressAll(result, solvingPresses);
    });

    test("完成演出へ進みプレイ事実を返すこと", () => {
      const { progress, sessionResult } = result.current;

      expect(progress).toBe("clearing");
      expect(sessionResult).toMatchObject({
        correctionCount: 0,
        restartCount: 0,
        inputCount: solvingPresses.length,
      });
    });

    test("完成演出を終えると完成の表示へ進むこと", () => {
      act(() => result.current.completeClearing());

      expect(result.current.progress).toBe("result");
    });

    test("同じ問題をもう一度始めると初期配置のプレイ中へ戻ること", () => {
      act(() => result.current.replay());

      expect(result.current.progress).toBe("playing");
      expect(result.current.cells[firstEmptyCellIndex]?.cell).toBeNull();
      expect(result.current.sessionResult).toBeNull();
      expect(result.current.problemIdentity).toEqual(initial.identity);
    });

    describe("新しい seed が別の問題を指す場合", () => {
      beforeEach(() => {
        vi.mocked(createProblemSeed).mockReturnValueOnce(otherSeed);
      });

      test("別の問題でその問題をプレイ中から始めること", () => {
        act(() => result.current.startNewProblem());

        expect(result.current.progress).toBe("playing");
        expect(result.current.sessionResult).toBeNull();
        expect(result.current.seed).toBe(otherSeed);
        expect(result.current.problemIdentity).toEqual(other.identity);
        expect(listCells(result)).toEqual(other.problem.givens.cells);
      });
    });
  });

  describe("最初の新しい seed が今と同じ問題を指す場合", () => {
    beforeEach(() => {
      vi.mocked(createProblemSeed)
        .mockReturnValueOnce(initialSeed)
        .mockReturnValueOnce(otherSeed);
    });

    test("別の問題で seed を引き直して別の問題を始めること", () => {
      act(() => result.current.startNewProblem());

      expect(other.identity).not.toEqual(initial.identity);
      expect(result.current.seed).toBe(otherSeed);
      expect(result.current.problemIdentity).toEqual(other.identity);
    });
  });
});
