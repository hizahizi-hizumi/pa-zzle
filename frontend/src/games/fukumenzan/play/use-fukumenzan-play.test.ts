import { act, cleanup, renderHook } from "@testing-library/react";

import { useFukumenzanPlay } from "@/games/fukumenzan/play/use-fukumenzan-play";
import { createFukumenzanProblemIdentity } from "@/games/fukumenzan/problem/problem";
import {
  type FukumenzanPooledProblem,
  listFukumenzanPoolProblemIds,
} from "@/games/fukumenzan/problem/problem-pool";
import {
  selectFukumenzanProblemById,
  selectFukumenzanProblemForDifficulty,
} from "@/games/fukumenzan/problem-selection";
import { createProblemId } from "@/games/problem-id";
import { createProblemSeed } from "@/games/problem-seed";

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: vi.fn(),
}));

type HookResult = { current: ReturnType<typeof useFukumenzanPlay> };

const problemId = createProblemId(
  createFukumenzanProblemIdentity({ addends: ["MBM", "DFM"], result: "MMLB" }),
);
const pooled: FukumenzanPooledProblem = selectFukumenzanProblemById(
  "1",
  problemId,
)!;
// 文字は M B D F L の順。121 + 981 = 1102 で解ける。
const solution = [1, 2, 9, 8, 0] as const;

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
  vi.mocked(createProblemSeed).mockReset();
});

/** レベル1の問題集から、その問題を選ぶ seed を探す。 */
function findSeedSelecting(problemIdToSelect: string): string {
  for (let index = 0; ; index += 1) {
    const seed = `use-fukumenzan-play-${index}`;
    const { identity } = selectFukumenzanProblemForDifficulty("1", seed);
    if (createProblemId(identity) === problemIdToSelect) {
      return seed;
    }
  }
}

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
      letters: ["M", "B", "D", "F", "L"],
      placedDigits: [null, null, null, null, null],
      canUndo: false,
      canRestart: false,
    });
  });

  describe("答えの先頭に 0 を入れ、一の位を埋めた場合", () => {
    beforeEach(() => {
      act(() => {
        hook.current.placeDigit(0, 0);
        hook.current.placeDigit(1, 1);
      });
    });

    test("先頭の0の文字と、合わない一の位を返すこと", () => {
      const { leadingZeroLetters, miscalculatedColumns } = hook.current;

      expect({ leadingZeroLetters, miscalculatedColumns }).toEqual({
        leadingZeroLetters: [0],
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

    test("× を外し、待ったを数え、× を戻した文字を知らせること", () => {
      const { puzzleState, undoCount, crossUndoNotice } = hook.current;

      expect({
        crossed: puzzleState.crossedDigits[0],
        undoCount,
        letter: crossUndoNotice?.letter,
      }).toEqual({ crossed: [], undoCount: 1, letter: 0 });
    });
  });

  describe("札を入れて待ったをした場合", () => {
    beforeEach(() => {
      act(() => {
        hook.current.placeDigit(0, 9);
      });
      act(() => {
        hook.current.undo();
      });
    });

    test("× を戻した文字を知らせないこと", () => {
      const { crossUndoNotice } = hook.current;

      expect(crossUndoNotice).toBeNull();
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

      describe("リセットした場合", () => {
        beforeEach(() => {
          act(() => {
            hook.current.replay();
          });
        });

        test("同じ問題を空の盤面から、回数0で始め直すこと", () => {
          const { problemIdentity, status, puzzleState, session } =
            hook.current;

          expect({
            problemId: createProblemId(problemIdentity),
            status,
            placedDigits: puzzleState.placedDigits,
            placeCount: session.placeCount,
            undoCount: session.undoCount,
          }).toEqual({
            problemId,
            status: "playing",
            placedDigits: [null, null, null, null, null],
            placeCount: 0,
            undoCount: 0,
          });
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

  describe("別の問題を始めた場合", () => {
    const otherProblemId = listFukumenzanPoolProblemIds("1").find(
      (id) => id !== problemId,
    )!;

    beforeEach(() => {
      vi.mocked(createProblemSeed)
        .mockReturnValueOnce(findSeedSelecting(problemId))
        .mockReturnValueOnce(findSeedSelecting(otherProblemId));
      act(() => {
        hook.current.placeDigit(0, 9);
      });
      act(() => {
        hook.current.startNewProblem();
      });
    });

    test("今の問題を避けて選んだ問題を、空の盤面で始めること", () => {
      const { problemIdentity, puzzleState } = hook.current;

      expect({
        problemId: createProblemId(problemIdentity),
        empty: puzzleState.placedDigits.every((digit) => digit === null),
      }).toEqual({ problemId: otherProblemId, empty: true });
    });
  });
});

describe("seed で問題を選んで始めた場合", () => {
  const seed = "use-fukumenzan-play-seeded";
  const selected = selectFukumenzanProblemForDifficulty("3", seed);
  let hook: HookResult;

  beforeEach(() => {
    vi.mocked(createProblemSeed).mockReturnValue(seed);
    hook = renderHook(() => useFukumenzanPlay("3")).result;
  });

  test("seed で選んだ問題を、空の盤面で始めること", () => {
    const { problemIdentity, problem, puzzleState } = hook.current;

    expect({
      problemIdentity,
      problem,
      empty: puzzleState.placedDigits.every((digit) => digit === null),
    }).toEqual({
      problemIdentity: selected.identity,
      problem: selected.problem,
      empty: true,
    });
  });
});

describe("× を戻した知らせを持たずに保存した進行中のプレイを開き直した場合", () => {
  let hook: HookResult;

  beforeEach(() => {
    const saved = renderHook(() =>
      useFukumenzanPlay("1", pooled, undefined, problemId),
    );
    act(() => {
      saved.result.current.placeDigit(0, 9);
    });
    saved.unmount();
    const key = "pa-zzle.active-play.v1.fukumenzan";
    const stored = JSON.parse(window.sessionStorage.getItem(key)!);
    delete stored.state.crossUndoNotice;
    window.sessionStorage.setItem(key, JSON.stringify(stored));
    hook = renderHook(() =>
      useFukumenzanPlay("1", pooled, undefined, problemId),
    ).result;
  });

  test("入れた札を戻し、知らせは持たないこと", () => {
    const { puzzleState, crossUndoNotice } = hook.current;

    expect({ placed: puzzleState.placedDigits[0], crossUndoNotice }).toEqual({
      placed: 9,
      crossUndoNotice: null,
    });
  });
});
