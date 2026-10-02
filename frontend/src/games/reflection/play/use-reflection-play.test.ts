import { act, cleanup, renderHook } from "@testing-library/react";
import { createProblemId } from "@/games/problem-id";

import { createProblemSeed } from "@/games/problem-seed";
import { useReflectionPlay } from "@/games/reflection/play/use-reflection-play";
import {
  createReflectionProblemIdentity,
  type ReflectionProblem,
} from "@/games/reflection/problem/problem";
import { selectReflectionProblemForDifficulty } from "@/games/reflection/problem-selection";
import {
  calculateReflectionPlayScore,
  calculateReflectionSpeedFullScoreMs,
} from "@/games/reflection/score";

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: vi.fn(),
}));

type HookResult = { current: ReturnType<typeof useReflectionPlay> };

const difficulty = "3";
const seed = "use-reflection-play-a";
const pooled = selectReflectionProblemForDifficulty(difficulty, seed);
const unpooledIdentity = createReflectionProblemIdentity(5, 3, 100_000);

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

    test("問題集から選んだ問題の作業の量と問題集の中の位置を返すこと", () => {
      const {
        problemIdentity,
        workload,
        poolReference,
        result: playResult,
      } = result.current;

      expect(problemIdentity).toEqual(pooled.identity);
      expect(workload).toEqual(pooled.workload);
      expect(poolReference).toEqual(pooled.poolReference);
      expect(playResult).toBeNull();
    });

    describe("解を置き切った場合", () => {
      beforeEach(() => {
        placeSolution(result, pooled.problem);
      });

      test("プレイの事実と作業の量から評価を返すこと", () => {
        const { sessionResult, result: playResult } = result.current;

        expect(sessionResult).not.toBeNull();
        expect(playResult).toMatchObject({
          ...sessionResult,
          workload: pooled.workload,
          speedFullScoreMs: calculateReflectionSpeedFullScoreMs(
            pooled.workload,
          ),
          score:
            sessionResult &&
            calculateReflectionPlayScore({
              ...sessionResult,
              workload: pooled.workload,
            }),
        });
      });

      test("記録に使う開始と完了の時刻を返すこと", () => {
        const { startedAt, completedAt, sessionResult } = result.current;

        expect(completedAt).not.toBeNull();
        expect((completedAt ?? 0) - startedAt).toBe(sessionResult?.elapsedMs);
      });
    });
  });

  describe("問題集に無い identity を渡した場合", () => {
    let result: HookResult;

    beforeEach(() => {
      vi.mocked(createProblemSeed).mockReturnValueOnce(seed);
      ({ result } = renderHook(() =>
        useReflectionPlay(difficulty, unpooledIdentity),
      ));
    });

    test("生成器で作った問題を作業の量と問題集の中の位置なしで出すこと", () => {
      const { problemIdentity, problemSource, workload, poolReference } =
        result.current;

      expect(problemIdentity).toEqual(unpooledIdentity);
      expect(problemSource).toBe("given");
      expect(workload).toBeNull();
      expect(poolReference).toBeNull();
    });
  });
});

describe("useReflectionPlay で避ける問題", () => {
  const firstSeed = "avoided-problem-first";
  const secondSeed = "avoided-problem-second";
  const firstProblem = selectReflectionProblemForDifficulty("3", firstSeed);
  const secondProblem = selectReflectionProblemForDifficulty("3", secondSeed);
  const firstProblemId = createProblemId(firstProblem.identity);
  let result: { current: ReturnType<typeof useReflectionPlay> };

  describe("最初の問題として避ける問題を渡した場合", () => {
    beforeEach(() => {
      vi.mocked(createProblemSeed)
        .mockReturnValueOnce("avoided-problem-first")
        .mockReturnValue("avoided-problem-second");
      ({ result } = renderHook(() =>
        useReflectionPlay("3", undefined, firstProblemId),
      ));
    });

    test("避ける問題を選び直して別の問題で始めること", () => {
      const { problemIdentity } = result.current;

      expect(secondProblem.identity).not.toEqual(firstProblem.identity);
      expect(problemIdentity).toEqual(secondProblem.identity);
    });
  });

  describe("最初の問題と避ける問題に同じ問題を渡した場合", () => {
    beforeEach(() => {
      vi.mocked(createProblemSeed).mockReturnValue("avoided-problem-second");
      ({ result } = renderHook(() =>
        useReflectionPlay("3", firstProblem.identity, firstProblemId),
      ));
    });

    test("渡した問題で始めること", () => {
      const { problemIdentity } = result.current;

      expect(problemIdentity).toEqual(firstProblem.identity);
    });
  });

  describe("新しい問題の最初の seed が遊んでいる問題を指す場合", () => {
    beforeEach(() => {
      vi.mocked(createProblemSeed)
        .mockReturnValueOnce("avoided-problem-first")
        .mockReturnValueOnce("avoided-problem-first")
        .mockReturnValue("avoided-problem-second");
      ({ result } = renderHook(() => useReflectionPlay("3")));
    });

    test("遊んでいる問題を避けて選び直した問題を始めること", () => {
      act(() => result.current.startNewProblem());
      const { problemIdentity } = result.current;

      expect(problemIdentity).toEqual(secondProblem.identity);
    });
  });
});
