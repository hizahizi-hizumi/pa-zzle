import { act, cleanup, renderHook } from "@testing-library/react";

import {
  assessNanpureDifficulty,
  type NanpureDifficulty,
} from "@/games/nanpure/difficulty";
import { analyzeNanpureDifficulty } from "@/games/nanpure/problem/difficulty-analysis";
import { restoreNanpureProblem } from "@/games/nanpure/problem/generator";
import * as problemSeed from "@/games/problem-seed";
import { useNanpurePlay } from "./use-nanpure-play";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type HookResult = ReturnType<typeof useNanpurePlay>;

describe("useNanpurePlay", () => {
  const difficultyCases = [
    ["easy", "nanpure-selection-easy"],
    ["normal", "nanpure-selection-normal"],
    ["hard", "nanpure-selection-hard"],
  ] as const;

  describe.each(difficultyCases)("%s の場合", (difficulty, seed) => {
    let result: { current: HookResult };

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue(seed);
      ({ result } = renderHook(() => useNanpurePlay(difficulty)));
    });

    test("対応する難易度の問題でプレイを開始すること", () => {
      const rating = assessNanpureDifficulty(
        analyzeNanpureDifficulty(result.current.clues),
      );

      expect(rating).toMatchObject({ status: "rated", difficulty });
    });
  });

  describe("新しい問題を開始する場合", () => {
    const initialProps: { difficulty: NanpureDifficulty } = {
      difficulty: "easy",
    };
    let result: { current: HookResult };
    let rerender: (props: { difficulty: NanpureDifficulty }) => void;

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed")
        .mockReturnValueOnce("nanpure-selection-easy")
        .mockReturnValueOnce("nanpure-selection-hard");
      ({ result, rerender } = renderHook(
        ({ difficulty }: { difficulty: NanpureDifficulty }) =>
          useNanpurePlay(difficulty),
        { initialProps },
      ));
    });

    test("現在選択中の難易度を問題生成へ反映すること", () => {
      rerender({ difficulty: "hard" });
      act(() => result.current.startNewProblem());
      const rating = assessNanpureDifficulty(
        analyzeNanpureDifficulty(result.current.clues),
      );

      expect(rating).toMatchObject({ status: "rated", difficulty: "hard" });
    });
  });

  describe("盤面を完成させる場合", () => {
    let result: { current: HookResult };
    let solution: ReturnType<typeof restoreNanpureProblem>["solution"];

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue(
        "nanpure-selection-normal",
      );
      ({ result } = renderHook(() => useNanpurePlay("normal")));
      solution = restoreNanpureProblem(result.current.problemIdentity).solution;
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
