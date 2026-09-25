import { act, cleanup, renderHook } from "@testing-library/react";

import { useSlidePuzzlePlay } from "@/games/slide-puzzle/play/use-slide-puzzle-play";
import { restoreSlidePuzzleProblemWithOptimalMoveCount } from "@/games/slide-puzzle/problem/generator";
import {
  listSlidePuzzlePoolEntries,
  toSlidePuzzlePooledProblem,
} from "@/games/slide-puzzle/problem/problem-pool";

// 最下段だけが 1 マスずつずれた盤面。右下のタイルをタップすると 3 枚まとめて滑って完成する。
vi.mock("@/games/slide-puzzle/problem-selection", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/games/slide-puzzle/problem-selection")
  >()),
  selectSlidePuzzleProblemForDifficulty: (
    _difficulty: string,
    seed: string,
  ) => ({
    problem: {
      initialBoard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 13, 14, 15],
    },
    identity: {
      generatorVersion: "1",
      seed,
      conditions: { size: 4, scrambleLength: 3 },
    },
    optimalMoveCount: 3,
  }),
}));

const initialBoard = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 13, 14, 15];
const solvedBoard = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];

type HookResult = { current: ReturnType<typeof useSlidePuzzlePlay> };

afterEach(() => {
  cleanup();
});

describe("useSlidePuzzlePlay", () => {
  let result: HookResult;
  let initialSeed: string;

  beforeEach(() => {
    ({ result } = renderHook(() => useSlidePuzzlePlay("1")));
    initialSeed = result.current.problemIdentity.seed;
  });

  test("空白と同じ行のタイルをタップすると間のタイルごと滑らせること", () => {
    act(() => result.current.slideTile(14));

    expect(result.current.board).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15,
    ]);
    expect(result.current.moveCount).toBe(2);
    expect(result.current.operation).toMatchObject({
      type: "slid",
      slide: { direction: "left", movedTileIndices: [13, 14] },
      boardBefore: initialBoard,
      isClearingMove: false,
    });
  });

  test("成立しないタップでは盤面と手数を変えず不成立を通知すること", () => {
    act(() => result.current.slideTile(1));

    expect(result.current.board).toEqual(initialBoard);
    expect(result.current.moveCount).toBe(0);
    expect(result.current.operation).toMatchObject({
      type: "invalid",
      tileIndex: 1,
    });
  });

  test("矢印キーの方向へ空白の隣のタイルを 1 枚滑らせること", () => {
    act(() => result.current.slideByKeyboard("left"));

    expect(result.current.board).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 0, 14, 15,
    ]);
    expect(result.current.moveCount).toBe(1);
  });

  test("タイルが無い方向の矢印キーでは何もしないこと", () => {
    act(() => result.current.slideByKeyboard("right"));

    expect(result.current.board).toEqual(initialBoard);
    expect(result.current.operation).toBeNull();
  });

  test("完成する手で完成演出へ進むこと", () => {
    act(() => result.current.slideTile(15));

    expect(result.current.board).toEqual(solvedBoard);
    expect(result.current.status).toBe("cleared");
    expect(result.current.progress).toBe("clearing");
    expect(result.current.result).toMatchObject({
      moveCount: 3,
      completionMoveCount: 3,
      slideCount: 1,
      restartCount: 0,
      optimalMoveCount: 3,
      moveDelta: 0,
      speedFullScoreMs: 16_000,
      score: { breakdown: { efficiency: 60 } },
    });
  });

  describe("完成した場合", () => {
    beforeEach(() => {
      act(() => result.current.slideTile(15));
    });

    test("完成演出の完了で結果へ進むこと", () => {
      act(() => result.current.completeClearing());

      expect(result.current.progress).toBe("result");
    });

    test("盤面へのタップを受け付けないこと", () => {
      act(() => result.current.slideTile(14));

      expect(result.current.board).toEqual(solvedBoard);
      expect(result.current.moveCount).toBe(3);
    });

    test("同じ問題を新しいプレイとして始め直せること", () => {
      act(() => result.current.replay());

      expect(result.current.board).toEqual(initialBoard);
      expect(result.current.status).toBe("playing");
      expect(result.current.progress).toBe("playing");
      expect(result.current.moveCount).toBe(0);
    });
  });

  describe("タイルを動かした場合", () => {
    beforeEach(() => {
      act(() => result.current.slideTile(13));
    });

    test("盤面を戻すと初期盤面へ戻り総手数を残すこと", () => {
      act(() => result.current.restart());

      expect(result.current.board).toEqual(initialBoard);
      expect(result.current.moveCount).toBe(1);
      expect(result.current.restartCount).toBe(1);
    });
  });

  test("別の問題では新しい seed の問題を始めること", () => {
    act(() => result.current.startNewProblem());

    expect(result.current.problemIdentity.seed).not.toBe(initialSeed);
    expect(result.current.moveCount).toBe(0);
  });

  describe("最初の問題を渡した場合", () => {
    const pooledEntries = listSlidePuzzlePoolEntries("4").slice(0, 1);
    const initialProblems = pooledEntries.map((entry) => {
      const { identity, optimalMoveCount } = toSlidePuzzlePooledProblem(entry);
      return [
        entry[0],
        restoreSlidePuzzleProblemWithOptimalMoveCount(
          identity,
          optimalMoveCount,
        ),
      ] as const;
    });

    test.each(initialProblems)(
      "渡した問題の初期盤面と最短手数で始めること: %s",
      (_seed, initialProblem) => {
        const restored = renderHook(() =>
          useSlidePuzzlePlay("4", initialProblem),
        );

        expect(restored.result.current.board).toEqual(
          initialProblem.problem.initialBoard,
        );
        expect(restored.result.current.problemIdentity).toEqual(
          initialProblem.identity,
        );
        expect(restored.result.current.optimalMoveCount).toBe(
          initialProblem.optimalMoveCount,
        );
      },
    );
  });
});
