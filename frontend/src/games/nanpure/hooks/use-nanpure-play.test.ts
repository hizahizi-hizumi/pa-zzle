import { act, cleanup, renderHook } from "@testing-library/react";

import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import { rateUniqueNanpureDifficulty } from "@/games/nanpure/problem/difficulty-rating";
import { restoreNanpureProblem } from "@/games/nanpure/problem/generator";
import * as problemSeed from "@/games/problem-seed";
import { useNanpurePlay } from "./use-nanpure-play";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useNanpurePlay", () => {
  test.each([
    ["easy", "nanpure-selection-easy"],
    ["normal", "nanpure-selection-normal"],
    ["hard", "nanpure-selection-hard"],
  ] as const)(
    "%s を選ぶと対応する難易度の問題でプレイを開始すること",
    (difficulty, seed) => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue(seed);

      const { result } = renderHook(() => useNanpurePlay(difficulty));
      const rating = rateUniqueNanpureDifficulty(result.current.clues);

      expect(rating).toMatchObject({ status: "rated", difficulty });
    },
  );

  test("新しい問題では現在選択中の難易度を問題生成へ反映すること", () => {
    vi.spyOn(problemSeed, "createProblemSeed")
      .mockReturnValueOnce("nanpure-selection-easy")
      .mockReturnValueOnce("nanpure-selection-hard");
    const { result, rerender } = renderHook(
      ({ difficulty }: { difficulty: NanpureDifficulty }) =>
        useNanpurePlay(difficulty),
      { initialProps: { difficulty: "easy" } },
    );
    const initialRating = rateUniqueNanpureDifficulty(result.current.clues);

    rerender({ difficulty: "hard" });
    act(() => result.current.startNewProblem());
    const nextRating = rateUniqueNanpureDifficulty(result.current.clues);

    expect(initialRating).toMatchObject({
      status: "rated",
      difficulty: "easy",
    });
    expect(nextRating).toMatchObject({ status: "rated", difficulty: "hard" });
  });
  test("盤面完成後に完成状態を見せてから結果表示へ進めること", () => {
    vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue(
      "nanpure-selection-normal",
    );
    const { result } = renderHook(() => useNanpurePlay("normal"));
    const problem = restoreNanpureProblem(result.current.problemIdentity);

    for (const [cellIndex, digit] of problem.solution.entries()) {
      if (result.current.board[cellIndex] !== null) {
        continue;
      }
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
