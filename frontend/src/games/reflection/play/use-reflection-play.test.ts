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
      act(() => result.current.tapStock(piece));
    }
    act(() => result.current.tapCell(cellIndex));
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
