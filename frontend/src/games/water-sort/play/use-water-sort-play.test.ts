import { act, cleanup, renderHook } from "@testing-library/react";

import {
  applyWaterSortMove,
  listWaterSortLegalMoves,
} from "@/games/water-sort/puzzle/rules";
import type { WaterSortMove } from "@/games/water-sort/puzzle/state";
import { useWaterSortPlay } from "./use-water-sort-play";

vi.mock("@/games/water-sort/problem-selection", () => ({
  generateWaterSortProblemForDifficulty: (
    difficulty: "easy" | "normal" | "hard",
    seed: string,
  ) => {
    const preparationMoveCount = difficulty === "easy" ? 1 : 3;
    const averageEmptyBottlePressure = difficulty === "hard" ? 0.75 : 0.5;
    const maximumDetourMoves = difficulty === "hard" ? 2 : 0;

    return {
      problem: {
        initialState: [[0, 0, 0, 1], [1, 1, 1, 0], [], []],
      },
      identity: {
        generatorVersion: "1",
        seed,
        conditions: { colorCount: 2, capacity: 4, emptyBottleCount: 2 },
        generationAttempt: 1,
      },
      optimalMoveCount: 3,
      difficultyAnalysis: {
        shortestMoveCount: 3,
        minimumMergeMoveCount: 2,
        preparationMoveCount,
        preparationMoveRatio: preparationMoveCount / 3,
        averageEmptyBottlePressure,
        noEmptyBottleStateRatio: 0,
        longestNoEmptyBottleRun: 0,
        representativeChoiceRisk: {
          stateIndex: 0,
          progressRatio: 0,
          distinctChoiceCount: 1,
          evaluatedChoiceCount: 1,
          unresolvedChoiceCount: 0,
          optimalChoiceRatio: difficulty === "hard" ? 0 : 1,
          detourChoiceRatio: difficulty === "hard" ? 1 : 0,
          deadEndChoiceRatio: 0,
          maximumDetourMoves,
        },
      },
    };
  },
}));

const solutionMoves: readonly WaterSortMove[] = [
  { sourceBottleIndex: 0, destinationBottleIndex: 2 },
  { sourceBottleIndex: 1, destinationBottleIndex: 0 },
  { sourceBottleIndex: 2, destinationBottleIndex: 1 },
];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type HookResult = ReturnType<typeof useWaterSortPlay>;

function performMove(
  result: { current: HookResult },
  move: { sourceBottleIndex: number; destinationBottleIndex: number },
) {
  act(() => result.current.selectBottle(move.sourceBottleIndex));
  act(() => result.current.selectBottle(move.destinationBottleIndex));
}

function solveCurrentProblem(result: { current: HookResult }) {
  for (const move of solutionMoves) {
    performMove(result, move);
  }
}

describe("useWaterSortPlay", () => {
  const difficultyCases = ["easy", "normal", "hard"] as const;

  describe.each(difficultyCases)("%s の場合", (difficulty) => {
    let result: { current: HookResult };

    beforeEach(() => {
      ({ result } = renderHook(() => useWaterSortPlay(difficulty)));
    });

    test("特徴量条件を満たす実盤面と最短手数をプレイ開始時から保持すること", () => {
      const emptyBottleCount = result.current.state.filter(
        (bottle) => bottle.length === 0,
      ).length;

      expect(emptyBottleCount).toBe(2);
      expect(result.current.optimalMoveCount).toBeGreaterThan(0);
      expect(result.current.problemDifficulty.difficulty).toBe(difficulty);
    });
  });

  describe("easy をプレイする場合", () => {
    let result: { current: HookResult };
    let initialState: HookResult["state"];
    let legalMove: WaterSortMove;

    beforeEach(() => {
      ({ result } = renderHook(() => useWaterSortPlay("easy")));
      initialState = result.current.state;
      const move = listWaterSortLegalMoves(initialState)[0];
      if (!move) {
        throw new Error("test problem must have a legal move");
      }
      legalMove = move;
    });

    test("合法な注ぎ元と注ぎ先を順に選ぶとパズルの状態遷移を適用すること", () => {
      const expected = applyWaterSortMove(initialState, legalMove);

      performMove(result, legalMove);

      expect(result.current.state).toEqual(expected);
      expect(result.current.moveCount).toBe(1);
      expect(result.current.sourceBottleIndex).toBeNull();
      expect(result.current.operation?.type).toBe("poured");
    });

    test("パズルのルールが拒否する注ぎ先では盤面と手数を変更しないこと", () => {
      act(() => result.current.selectBottle(legalMove.sourceBottleIndex));
      const legalDestinations = new Set(
        listWaterSortLegalMoves(result.current.state)
          .filter(
            (move) => move.sourceBottleIndex === legalMove.sourceBottleIndex,
          )
          .map((move) => move.destinationBottleIndex),
      );
      const illegalDestination = result.current.state.findIndex(
        (_, bottleIndex) =>
          bottleIndex !== legalMove.sourceBottleIndex &&
          !legalDestinations.has(bottleIndex),
      );
      if (illegalDestination < 0) {
        throw new Error("test problem must have an illegal destination");
      }

      act(() => result.current.selectBottle(illegalDestination));

      expect(result.current.state).toEqual(initialState);
      expect(result.current.moveCount).toBe(0);
      expect(result.current.sourceBottleIndex).toBe(
        legalMove.sourceBottleIndex,
      );
      expect(result.current.operation?.type).toBe("invalid");
    });

    test("元に戻して盤面を復元しても成立済みの注水手数を減らさないこと", () => {
      performMove(result, legalMove);

      act(() => result.current.undo());

      expect(result.current.state).toEqual(initialState);
      expect(result.current.moveCount).toBe(1);
      expect(result.current.undoCount).toBe(1);
      expect(result.current.canUndo).toBe(false);
    });

    test("元に戻せる履歴がない操作は回数へ含めないこと", () => {
      act(() => result.current.undo());

      expect(result.current.undoCount).toBe(0);
      expect(result.current.canUndo).toBe(false);
    });

    test("盤面が完成すると最終注水待ちを経て結果表示へ進むこと", () => {
      solveCurrentProblem(result);

      expect(result.current.status).toBe("cleared");
      expect(result.current.progress).toBe("clearing");
      expect(result.current.result).toEqual({
        elapsedMs: expect.any(Number),
        moveCount: result.current.optimalMoveCount,
        completionMoveCount: result.current.optimalMoveCount,
        undoCount: 0,
        restartCount: 0,
        optimalMoveCount: result.current.optimalMoveCount,
        moveDelta: 0,
        backtrackMoveCount: 0,
        speedFullScoreMs: expect.any(Number),
        colorCount: result.current.problemIdentity.conditions.colorCount,
        score: {
          total: 100,
          breakdown: { efficiency: 40, speed: 40, accuracy: 20 },
        },
      });

      act(() => result.current.completeClearingPour());

      expect(result.current.progress).toBe("result");
    });
  });

  describe("プレイ中にやり直す場合", () => {
    let result: { current: HookResult };
    let initialState: HookResult["state"];
    let initialSeed: string;
    let initialProblemIdentity: HookResult["problemIdentity"];

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-16T00:00:00Z"));
      ({ result } = renderHook(() => useWaterSortPlay("easy")));
      initialState = result.current.state;
      initialSeed = result.current.seed;
      initialProblemIdentity = result.current.problemIdentity;
      const move = listWaterSortLegalMoves(initialState)[0];
      if (!move) {
        throw new Error("test problem must have a legal move");
      }
      performMove(result, move);
      act(() => vi.advanceTimersByTime(3_000));
    });

    test("同じ問題へ戻し手数と経過時間を累積すること", () => {
      act(() => result.current.restart());

      expect(result.current.state).toEqual(initialState);
      expect(result.current.seed).toBe(initialSeed);
      expect(result.current.problemIdentity).toEqual(initialProblemIdentity);
      expect(result.current.moveCount).toBe(1);
      expect(result.current.restartCount).toBe(1);
      expect(result.current.elapsedMs).toBe(3_000);
      expect(result.current.canUndo).toBe(false);
    });
  });

  describe("新しい問題を開始する場合", () => {
    let result: { current: HookResult };
    let initialSeed: string;
    let initialProblemIdentity: HookResult["problemIdentity"];

    beforeEach(() => {
      ({ result } = renderHook(() => useWaterSortPlay("easy")));
      initialSeed = result.current.seed;
      initialProblemIdentity = result.current.problemIdentity;
      const move = listWaterSortLegalMoves(result.current.state)[0];
      if (!move) {
        throw new Error("test problem must have a legal move");
      }
      performMove(result, move);
      act(() => result.current.undo());
      act(() => result.current.restart());
    });

    test("別シードへ切り替えてプレイ成績を初期化すること", () => {
      act(() => result.current.startNewProblem());

      expect(result.current.seed).not.toBe(initialSeed);
      expect(result.current.problemIdentity).not.toEqual(
        initialProblemIdentity,
      );
      expect(result.current.problemIdentity.seed).toBe(result.current.seed);
      expect(result.current.moveCount).toBe(0);
      expect(result.current.undoCount).toBe(0);
      expect(result.current.restartCount).toBe(0);
    });
  });

  describe("クリア済みの場合", () => {
    let result: { current: HookResult };
    let initialState: HookResult["state"];
    let initialSeed: string;

    beforeEach(() => {
      ({ result } = renderHook(() => useWaterSortPlay("easy")));
      initialState = result.current.state;
      initialSeed = result.current.seed;
      solveCurrentProblem(result);
    });

    test("同じ問題へ再挑戦すると同じシードで別プレイとして計測すること", () => {
      act(() => result.current.replay());

      expect(result.current.status).toBe("playing");
      expect(result.current.progress).toBe("playing");
      expect(result.current.state).toEqual(initialState);
      expect(result.current.seed).toBe(initialSeed);
      expect(result.current.moveCount).toBe(0);
      expect(result.current.undoCount).toBe(0);
      expect(result.current.restartCount).toBe(0);
      expect(result.current.result).toBeNull();
    });
  });
});
