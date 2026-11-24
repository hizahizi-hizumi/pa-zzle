import { act, cleanup, renderHook } from "@testing-library/react";

import { useFukumenzanPlay } from "@/games/fukumenzan/play/use-fukumenzan-play";
import { createFukumenzanProblemIdentity } from "@/games/fukumenzan/problem/problem";
import type { FukumenzanPooledProblem } from "@/games/fukumenzan/problem/problem-pool";
import { selectFukumenzanProblemById } from "@/games/fukumenzan/problem-selection";
import { createProblemId } from "@/games/problem-id";

type HookResult = { current: ReturnType<typeof useFukumenzanPlay> };

const problemId = createProblemId(
  createFukumenzanProblemIdentity({ addends: ["BYK", "KTK"], result: "TKHH" }),
);
const pooled: FukumenzanPooledProblem = selectFukumenzanProblemById(
  "1",
  problemId,
)!;
// 文字は B Y K T H の順。985 + 515 = 1500 で解ける。
const solution = [9, 8, 5, 1, 0] as const;

function placeSolution(result: HookResult, skipLast = false): void {
  const placements = solution.map((digit, letter) => [letter, digit] as const);
  for (const [letter, digit] of skipLast
    ? placements.slice(0, -1)
    : placements) {
    act(() => {
      result.current.placeDigit(letter, digit);
    });
  }
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("useFukumenzanPlay", () => {
  let hook: HookResult;

  beforeEach(() => {
    hook = renderHook(() => useFukumenzanPlay("1", pooled)).result;
  });

  test("式の文字と空の盤面で始めること", () => {
    const { letters, puzzleState, canUndo, canRestart } = hook.current;

    expect({
      letters,
      placedDigits: puzzleState.placedDigits,
      canUndo,
      canRestart,
    }).toEqual({
      letters: ["B", "Y", "K", "T", "H"],
      placedDigits: [null, null, null, null, null],
      canUndo: false,
      canRestart: false,
    });
  });

  describe("答えの先頭に 0 を入れ、一の位を埋めた場合", () => {
    beforeEach(() => {
      act(() => {
        hook.current.placeDigit(3, 0);
        hook.current.placeDigit(2, 5);
        hook.current.placeDigit(4, 1);
      });
    });

    test("先頭の0の文字と、合わない一の位を返すこと", () => {
      const { leadingZeroLetters, miscalculatedColumns } = hook.current;

      expect({ leadingZeroLetters, miscalculatedColumns }).toEqual({
        leadingZeroLetters: [3],
        miscalculatedColumns: [0],
      });
    });
  });

  describe("× を付けて待ったをした場合", () => {
    beforeEach(() => {
      act(() => {
        hook.current.toggleCross(0, 1);
      });
      act(() => {
        hook.current.undo();
      });
    });

    test("× を外し、待ったを数えること", () => {
      const { puzzleState, undoCount } = hook.current;

      expect({ crossed: puzzleState.crossedDigits[0], undoCount }).toEqual({
        crossed: [],
        undoCount: 1,
      });
    });
  });

  describe("最後の文字を残して埋めた場合", () => {
    beforeEach(() => {
      placeSolution(hook, true);
    });

    test("まだ結果を持たないこと", () => {
      const { progress, result } = hook.current;

      expect({ progress, result }).toEqual({
        progress: "playing",
        result: null,
      });
    });

    describe("最後の文字を入れた場合", () => {
      beforeEach(() => {
        act(() => {
          hook.current.placeDigit(4, 0);
        });
      });

      test("完成演出へ進み、事実と作業の量から結果を作ること", () => {
        const { progress, result } = hook.current;

        expect(progress).toBe("clearing");
        expect(result).toMatchObject({
          placeCount: 5,
          workload: { letterCount: 5, letterCellCount: 10 },
          score: { total: 100 },
        });
      });

      describe("完成演出を終えた場合", () => {
        beforeEach(() => {
          act(() => {
            hook.current.completeClearAnimation();
          });
        });

        test("結果へ進むこと", () => {
          const { progress } = hook.current;

          expect(progress).toBe("result");
        });
      });
    });
  });

  describe("札を入れて盤面を戻した場合", () => {
    beforeEach(() => {
      act(() => {
        hook.current.placeDigit(0, 9);
      });
      act(() => {
        hook.current.restart();
      });
    });

    test("全部の文字を空にし、待ったでは戻せないこと", () => {
      const { puzzleState, canUndo, session } = hook.current;

      expect({
        placedDigits: puzzleState.placedDigits,
        canUndo,
        restartCount: session.restartCount,
      }).toEqual({
        placedDigits: [null, null, null, null, null],
        canUndo: false,
        restartCount: 1,
      });
    });
  });
});
