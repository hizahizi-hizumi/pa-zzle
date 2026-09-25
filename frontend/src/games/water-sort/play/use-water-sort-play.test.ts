import { act, cleanup, renderHook } from "@testing-library/react";
import { useWaterSortPlay } from "@/games/water-sort/play/use-water-sort-play";
import {
  applyWaterSortMove,
  listWaterSortLegalMoves,
} from "@/games/water-sort/puzzle/rules";
import type { WaterSortMove } from "@/games/water-sort/puzzle/state";

vi.mock("@/games/water-sort/problem-selection", () => ({
  selectWaterSortProblemForDifficulty: (_difficulty: string, seed: string) => ({
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
  }),
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
  test.each(["1", "2", "3", "4", "5"] as const)(
    "難易度 %s の問題の実盤面と最短手数をプレイ開始時から保持すること",
    (difficulty) => {
      const { result } = renderHook(() => useWaterSortPlay(difficulty));

      expect(
        result.current.state.filter((bottle) => bottle.length === 0),
      ).toHaveLength(2);
      expect(result.current.optimalMoveCount).toBeGreaterThan(0);
    },
  );

  test("合法な注ぎ元と注ぎ先を順に選ぶとパズルの状態遷移を適用すること", () => {
    const { result } = renderHook(() => useWaterSortPlay("1"));
    const move = listWaterSortLegalMoves(result.current.state)[0];
    expect(move).toBeDefined();
    if (!move) return;
    const expected = applyWaterSortMove(result.current.state, move);

    performMove(result, move);

    expect(result.current.state).toEqual(expected);
    expect(result.current.moveCount).toBe(1);
    expect(result.current.sourceBottleIndex).toBeNull();
    expect(result.current.operation?.type).toBe("poured");
  });

  test("パズルのルールが拒否する注ぎ先では盤面と手数を変更しないこと", () => {
    const { result } = renderHook(() => useWaterSortPlay("1"));
    const legalMove = listWaterSortLegalMoves(result.current.state)[0];
    expect(legalMove).toBeDefined();
    if (!legalMove) return;
    const initialState = result.current.state;
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
    expect(illegalDestination).toBeGreaterThanOrEqual(0);

    act(() => result.current.selectBottle(illegalDestination));

    expect(result.current.state).toEqual(initialState);
    expect(result.current.moveCount).toBe(0);
    expect(result.current.sourceBottleIndex).toBe(legalMove.sourceBottleIndex);
    expect(result.current.operation?.type).toBe("invalid");
  });

  test("元に戻して盤面を復元しても成立済みの注水手数を減らさないこと", () => {
    const { result } = renderHook(() => useWaterSortPlay("1"));
    const initialState = result.current.state;
    const move = listWaterSortLegalMoves(initialState)[0];
    expect(move).toBeDefined();
    if (!move) return;

    performMove(result, move);
    act(() => result.current.undo());

    expect(result.current.state).toEqual(initialState);
    expect(result.current.moveCount).toBe(1);
    expect(result.current.undoCount).toBe(1);
    expect(result.current.canUndo).toBe(false);
  });

  test("元に戻せる履歴がない操作は回数へ含めないこと", () => {
    const { result } = renderHook(() => useWaterSortPlay("1"));

    act(() => result.current.undo());

    expect(result.current.undoCount).toBe(0);
    expect(result.current.canUndo).toBe(false);
  });

  test("プレイ中のやり直しは同じ問題へ戻し手数と経過時間を累積すること", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-16T00:00:00Z"));
    const { result } = renderHook(() => useWaterSortPlay("1"));
    const initialState = result.current.state;
    const initialSeed = result.current.seed;
    const initialProblemIdentity = result.current.problemIdentity;
    const move = listWaterSortLegalMoves(initialState)[0];
    expect(move).toBeDefined();
    if (!move) return;
    performMove(result, move);
    act(() => vi.advanceTimersByTime(3_000));

    act(() => result.current.restart());

    expect(result.current.state).toEqual(initialState);
    expect(result.current.seed).toBe(initialSeed);
    expect(result.current.problemIdentity).toEqual(initialProblemIdentity);
    expect(result.current.moveCount).toBe(1);
    expect(result.current.restartCount).toBe(1);
    expect(result.current.elapsedMs).toBe(3_000);
    expect(result.current.canUndo).toBe(false);
  });

  test("新しい問題では別シードへ切り替えてプレイ成績を初期化すること", () => {
    const { result } = renderHook(() => useWaterSortPlay("1"));
    const initialSeed = result.current.seed;
    const initialProblemIdentity = result.current.problemIdentity;
    const move = listWaterSortLegalMoves(result.current.state)[0];
    expect(move).toBeDefined();
    if (!move) return;
    performMove(result, move);
    act(() => result.current.undo());
    act(() => result.current.restart());

    act(() => result.current.startNewProblem());

    expect(result.current.seed).not.toBe(initialSeed);
    expect(result.current.problemIdentity).not.toEqual(initialProblemIdentity);
    expect(result.current.problemIdentity.seed).toBe(result.current.seed);
    expect(result.current.moveCount).toBe(0);
    expect(result.current.undoCount).toBe(0);
    expect(result.current.restartCount).toBe(0);
  });

  test("盤面が完成すると最終注水待ちを経て結果表示へ進むこと", () => {
    const { result } = renderHook(() => useWaterSortPlay("1"));

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
      timeDeltaMs: expect.any(Number),
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

  test("クリア後に同じ問題へ再挑戦すると同じシードで別プレイとして計測すること", () => {
    const { result } = renderHook(() => useWaterSortPlay("1"));
    const initialState = result.current.state;
    const initialSeed = result.current.seed;
    solveCurrentProblem(result);
    expect(result.current.status).toBe("cleared");

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
