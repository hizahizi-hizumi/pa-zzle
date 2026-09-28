import { act, cleanup, renderHook } from "@testing-library/react";

import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import { useNanpurePlay } from "@/games/nanpure/play/use-nanpure-play";
import { selectNanpureProblemForDifficulty } from "@/games/nanpure/problem-selection";
import * as problemSeed from "@/games/problem-seed";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type HookResult = ReturnType<typeof useNanpurePlay>;

describe("useNanpurePlay", () => {
  const difficultyCases = [
    ["1", "nanpure-selection-1"],
    ["3", "nanpure-selection-3"],
    ["5", "nanpure-selection-5"],
  ] as const;

  describe.each(difficultyCases)("レベル %s の場合", (difficulty, seed) => {
    const expected = selectNanpureProblemForDifficulty(difficulty, seed);
    let result: { current: HookResult };

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue(seed);
      ({ result } = renderHook(() => useNanpurePlay(difficulty)));
    });

    test("その難易度の問題集から選んだ問題でプレイを開始すること", () => {
      const { clues, problemIdentity } = result.current;

      expect(problemIdentity).toEqual(expected.identity);
      expect(clues).toEqual(expected.problem.clues);
    });
  });

  describe("再プレイする問題を渡した場合", () => {
    const initialProblem = selectNanpureProblemForDifficulty("4", "replayed");
    let result: { current: HookResult };

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue("other");
      ({ result } = renderHook(() => useNanpurePlay("4", initialProblem)));
    });

    test("渡した問題でプレイを開始すること", () => {
      const { problemIdentity } = result.current;

      expect(problemIdentity).toEqual(initialProblem.identity);
    });
  });

  describe("新しい問題を開始する場合", () => {
    const initialProps: { difficulty: NanpureDifficulty } = {
      difficulty: "1",
    };
    const expected = selectNanpureProblemForDifficulty("5", "nanpure-next");
    let result: { current: HookResult };
    let rerender: (props: { difficulty: NanpureDifficulty }) => void;

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed")
        .mockReturnValueOnce("nanpure-first")
        .mockReturnValue("nanpure-next");
      ({ result, rerender } = renderHook(
        ({ difficulty }: { difficulty: NanpureDifficulty }) =>
          useNanpurePlay(difficulty),
        { initialProps },
      ));
    });

    test("現在選択中の難易度の問題集から選び直すこと", () => {
      rerender({ difficulty: "5" });
      act(() => result.current.startNewProblem());
      const { problemIdentity } = result.current;

      expect(problemIdentity).toEqual(expected.identity);
    });
  });

  describe("盤面を完成させる場合", () => {
    const { solution } = selectNanpureProblemForDifficulty(
      "2",
      "nanpure-selection-2",
    ).problem;
    let result: { current: HookResult };

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue(
        "nanpure-selection-2",
      );
      ({ result } = renderHook(() => useNanpurePlay("2")));
    });

    test("完成状態を見せてから結果表示へ進めること", () => {
      for (const [cellIndex, digit] of solution.entries()) {
        if (result.current.board[cellIndex] !== null) continue;
        act(() => result.current.selectCell(cellIndex));
        act(() => result.current.inputDigit(digit));
      }

      expect(result.current.status).toBe("cleared");
      expect(result.current.progress).toBe("clearing");
      expect(result.current.result).not.toBeNull();
      expect(result.current.result?.score.total).toBe(100);

      act(() => result.current.completeClearAnimation());

      expect(result.current.progress).toBe("result");
    });
  });
});
