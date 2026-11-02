import { act, cleanup, renderHook } from "@testing-library/react";

import { useBridgesPlay } from "@/games/bridges/play/use-bridges-play";
import { countBridgesSolutions } from "@/games/bridges/problem/generation/exact-solver";
import { selectBridgesProblemForDifficulty } from "@/games/bridges/problem-selection";
import { createProblemId } from "@/games/problem-id";
import { createProblemSeed } from "@/games/problem-seed";

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: vi.fn(),
}));

type HookResult = { current: ReturnType<typeof useBridgesPlay> };

const difficulty = "2";
const initialSeed = "use-bridges-play-a";
const otherSeed = "use-bridges-play-b";
const initial = selectBridgesProblemForDifficulty(difficulty, initialSeed);
const other = selectBridgesProblemForDifficulty(difficulty, otherSeed);
const solution = countBridgesSolutions(initial.problem, {
  limit: 1,
  nodeLimit: 200_000,
}).firstSolution!;
const firstEdge = solution.findIndex((count) => count > 0);

/** 解の橋を辺ごとに、本数の回数だけ回す。`skipLast` なら最後の1回を残す。 */
function placeSolution(result: HookResult, skipLast = false): void {
  const steps = solution.flatMap((count, edge) =>
    Array.from({ length: count }, () => edge),
  );
  for (const edge of skipLast ? steps.slice(0, -1) : steps) {
    act(() => {
      result.current.cycleEdge(edge);
    });
  }
}

afterEach(() => {
  cleanup();
  vi.mocked(createProblemSeed).mockReset();
});

describe("useBridgesPlay", () => {
  let result: HookResult;

  beforeEach(() => {
    vi.mocked(createProblemSeed)
      .mockReturnValueOnce(initialSeed)
      .mockReturnValue(otherSeed);
    result = renderHook(() => useBridgesPlay(difficulty)).result;
  });

  test("seed で選んだ問題を、橋の無い盤面で始めること", () => {
    const { problemIdentity, bridges, progress } = result.current;

    expect({ problemIdentity, bridges, progress }).toEqual({
      problemIdentity: initial.identity,
      bridges: solution.map(() => 0),
      progress: "playing",
    });
  });

  describe("橋を1本架けた場合", () => {
    beforeEach(() => {
      act(() => {
        result.current.cycleEdge(firstEdge);
      });
    });

    test("待ったと盤面を戻すが使えること", () => {
      const { canUndo, canRestart } = result.current;

      expect({ canUndo, canRestart }).toEqual({
        canUndo: true,
        canRestart: true,
      });
    });

    test("待ったで橋を外し、待ったの回数を数えること", () => {
      act(() => {
        result.current.undo();
      });
      const { bridges, undoCount } = result.current;

      expect({ placed: bridges[firstEdge], undoCount }).toEqual({
        placed: 0,
        undoCount: 1,
      });
    });

    test("盤面を戻すで橋を全部外し、待ったも使えなくなること", () => {
      act(() => {
        result.current.restart();
      });
      const { bridges, canUndo, canRestart } = result.current;

      expect({
        empty: bridges.every((count) => count === 0),
        canUndo,
        canRestart,
      }).toEqual({ empty: true, canUndo: false, canRestart: false });
    });
  });

  describe("解の橋を全部架けた場合", () => {
    beforeEach(() => {
      placeSolution(result);
    });

    test("クリアして盤面を見せたまま、評価の無い完成演出の段へ進むこと", () => {
      const { status, progress, result: playResult } = result.current;

      expect({ status, progress, playResult }).toEqual({
        status: "cleared",
        progress: "clearing",
        playResult: null,
      });
    });

    test("リセットで同じ問題を橋の無い盤面から始め直すこと", () => {
      act(() => {
        result.current.replay();
      });
      const { problemIdentity, status, bridges } = result.current;

      expect({
        problemId: createProblemId(problemIdentity),
        status,
        empty: bridges.every((count) => count === 0),
      }).toEqual({
        problemId: createProblemId(initial.identity),
        status: "playing",
        empty: true,
      });
    });
  });

  describe("別の問題を始めた場合", () => {
    beforeEach(() => {
      placeSolution(result, true);
      act(() => {
        result.current.startNewProblem();
      });
    });

    test("今の問題を避けて選んだ問題を、橋の無い盤面で始めること", () => {
      const { problemIdentity, bridges, status } = result.current;

      expect({
        problemIdentity,
        empty: bridges.every((count) => count === 0),
        status,
      }).toEqual({
        problemIdentity: other.identity,
        empty: true,
        status: "playing",
      });
    });
  });
});
