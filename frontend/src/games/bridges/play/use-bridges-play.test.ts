import { act, cleanup, renderHook } from "@testing-library/react";

import { useBridgesPlay } from "@/games/bridges/play/use-bridges-play";
import { countBridgesSolutions } from "@/games/bridges/problem/generation/exact-solver";
import { measureBridgesSolveWorkload } from "@/games/bridges/problem/workload";
import { selectBridgesProblemForDifficulty } from "@/games/bridges/problem-selection";
import { getBridgesNetwork } from "@/games/bridges/puzzle/board";
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
  describe("交わる橋に阻まれた場合", () => {
    let blocked: HookResult;
    const crossing = selectBridgesProblemForDifficulty(
      "5",
      "use-bridges-play-crossing",
    );
    const network = getBridgesNetwork(crossing.problem);
    const crossingEdge = network.crossingEdges.findIndex(
      (crossings) => crossings.length > 0,
    );
    const crossedEdge = network.crossingEdges[crossingEdge]![0]!;

    beforeEach(() => {
      blocked = renderHook(() => useBridgesPlay("5", crossing)).result;
      act(() => {
        blocked.current.cycleEdge(crossingEdge);
      });
      act(() => {
        blocked.current.cycleEdge(crossedEdge);
      });
    });

    test("架けずに、阻んだ橋の辺を橋の変化として返すこと", () => {
      const { edgeNotice, bridges } = blocked.current;

      expect({ edgeNotice, placed: bridges[crossedEdge] }).toMatchObject({
        edgeNotice: {
          change: "blocked",
          edge: crossedEdge,
          crossingEdges: [crossingEdge],
        },
        placed: 0,
      });
    });
  });

  describe("seed で問題を選んで始めた場合", () => {
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

      test("架けた辺と本数を、橋の変化として返すこと", () => {
        const { edgeNotice } = result.current;

        expect(edgeNotice).toMatchObject({
          change: "changed",
          edge: firstEdge,
          count: 1,
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

      test("クリアして完成演出の段へ進み、遊んだ問題の作業の量で評価を返すこと", () => {
        const { status, progress, result: playResult } = result.current;

        expect({
          status,
          progress,
          inputCount: playResult?.inputCount,
          workload: playResult?.workload,
          speedScore: playResult?.score.breakdown.speed,
        }).toEqual({
          status: "cleared",
          progress: "clearing",
          inputCount: solution.reduce((total, count) => total + count, 0),
          workload: measureBridgesSolveWorkload(initial),
          speedScore: 100,
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
});
