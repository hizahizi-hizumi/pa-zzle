import { act, cleanup, renderHook } from "@testing-library/react";

import { createProblemSeed } from "@/games/problem-seed";
import { useReflectionPlay } from "@/games/reflection/play/use-reflection-play";
import type { ReflectionProblem } from "@/games/reflection/problem/problem";
import { selectReflectionProblemForDifficulty } from "@/games/reflection/problem-selection";
import {
  calculateReflectionPlayScore,
  calculateReflectionSpeedScoreRule,
} from "@/games/reflection/score";

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: vi.fn(),
}));

type HookResult = { current: ReturnType<typeof useReflectionPlay> };

const difficulty = "3";
const seed = "use-reflection-play-a";
const pooled = selectReflectionProblemForDifficulty(difficulty, seed);

/** ストックから種類を選び、解のマスへ置く。同じ種類が続くときは選択が残るので選び直さない。 */
function placeSolution(result: HookResult, problem: ReflectionProblem): void {
  problem.solution.cells.forEach((piece, cellIndex) => {
    if (piece === null) return;

    const { selection } = result.current;
    if (selection?.type !== "stock" || selection.piece !== piece) {
      act(() => result.current.selectStockPiece(piece));
    }
    act(() => result.current.selectCell(cellIndex));
  });
}

afterEach(() => {
  cleanup();
  vi.mocked(createProblemSeed).mockReset();
});

describe("useReflectionPlay", () => {
  describe("難易度だけを渡した場合", () => {
    let result: HookResult;

    beforeEach(() => {
      vi.mocked(createProblemSeed).mockReturnValueOnce(seed);
      ({ result } = renderHook(() => useReflectionPlay(difficulty)));
    });

    test("問題集から選んだ問題と問題集の中の位置を返すこと", () => {
      const {
        problemIdentity,
        poolReference,
        result: playResult,
      } = result.current;

      expect(problemIdentity).toEqual(pooled.identity);
      expect(poolReference).toEqual(pooled.poolReference);
      expect(playResult).toBeNull();
    });

    describe("ピースを置いた場合", () => {
      const solutionCells = pooled.problem.solution.cells;
      const placedCellIndex = solutionCells.findIndex((cell) => cell !== null);
      const placedPiece = solutionCells[placedCellIndex]!;
      const emptyCellIndex = solutionCells.indexOf(null);

      beforeEach(() => {
        act(() => result.current.selectStockPiece(placedPiece));
        act(() => result.current.selectCell(placedCellIndex));
      });

      test("置いたことを操作の知らせとして返すこと", () => {
        expect(result.current.operation?.type).toBe("piece-placed");
      });

      test("盤面のピースを選ぶと選んだことを知らせること", () => {
        act(() => result.current.clearSelection());
        act(() => result.current.selectCell(placedCellIndex));

        expect(result.current.operation?.type).toBe("selected");
      });

      test("選択を解くと選択を解いたことを知らせること", () => {
        act(() => result.current.clearSelection());

        expect(result.current.operation?.type).toBe("deselected");
      });

      test("別のマスへ移すと移したことを知らせること", () => {
        act(() => result.current.clearSelection());
        act(() => result.current.selectCell(placedCellIndex));
        act(() => result.current.selectCell(emptyCellIndex));

        expect(result.current.operation?.type).toBe("piece-moved");
      });

      test("手持ちへ戻すと戻したことを知らせること", () => {
        act(() => result.current.removePiece(placedCellIndex));

        expect(result.current.operation?.type).toBe("piece-returned");
      });

      test("外周ヒントを押すと光路を表示したことを知らせ、閉じても知らせないこと", () => {
        const entry = { side: "top", index: 0 } as const;

        act(() => result.current.selectClue(entry));
        expect(result.current.operation).toMatchObject({
          type: "laser-shown",
          entry,
        });

        act(() => result.current.selectClue(entry));
        expect(result.current.operation).toBeNull();
      });

      test("盤面を戻しても知らせないこと", () => {
        act(() => result.current.restart());

        expect(result.current.operation).toBeNull();
      });
    });

    describe("解を置き切った場合", () => {
      beforeEach(() => {
        placeSolution(result, pooled.problem);
      });

      test("プレイの事実と作業の量から評価を返すこと", () => {
        const playResult = result.current.result;

        expect(playResult).toMatchObject({
          relocationCount: 0,
          restartCount: 0,
          workload: pooled.workload,
          speedRule: calculateReflectionSpeedScoreRule(pooled.workload),
          score:
            playResult &&
            calculateReflectionPlayScore({
              elapsedMs: playResult.elapsedMs,
              workload: pooled.workload,
            }),
        });
      });

      test("記録に使う開始と完了の時刻を返すこと", () => {
        const { startedAt, completedAt, result: playResult } = result.current;

        expect(completedAt).not.toBeNull();
        expect((completedAt ?? 0) - startedAt).toBe(playResult?.elapsedMs);
      });
    });
  });
});
