import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  applyWaterSortMove,
  listWaterSortLegalMoves,
} from "@/games/water-sort/game/rules";
import { solveWaterSort } from "@/games/water-sort/game/solver";

import { useWaterSortGame } from "./use-water-sort-game";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type HookResult = ReturnType<typeof useWaterSortGame>;

function performMove(
  result: { current: HookResult },
  move: { sourceBottleIndex: number; destinationBottleIndex: number },
) {
  act(() => result.current.selectBottle(move.sourceBottleIndex));
  act(() => result.current.selectBottle(move.destinationBottleIndex));
}

function solveCurrentProblem(result: { current: HookResult }) {
  const solved = solveWaterSort(result.current.state);
  expect(solved.status).toBe("solved");

  for (const move of solved.moves) {
    performMove(result, move);
  }
}

describe("useWaterSortGame", () => {
  test.each([
    ["easy", 6],
    ["normal", 8],
    ["hard", 10],
  ] as const)(
    "%s と分類された実盤面と最短手数をプレイ開始時から保持すること",
    (difficulty, bottleCount) => {
      const { result } = renderHook(() => useWaterSortGame(difficulty));

      const state = result.current.state;
      const optimalMoveCount = result.current.optimalMoveCount;

      expect(state).toHaveLength(bottleCount);
      expect(state.filter((bottle) => bottle.length === 0)).toHaveLength(2);
      expect(optimalMoveCount).toBeGreaterThan(0);
      expect(result.current.problemDifficulty.difficulty).toBe(difficulty);
    },
  );

  test("合法な注ぎ元と注ぎ先を順に選ぶとゲーム核の状態遷移を適用すること", () => {
    const { result } = renderHook(() => useWaterSortGame("easy"));
    const move = listWaterSortLegalMoves(result.current.state)[0];
    expect(move).toBeDefined();
    if (!move) {
      return;
    }
    const expected = applyWaterSortMove(result.current.state, move);

    performMove(result, move);

    expect(result.current.state).toEqual(expected);
    expect(result.current.moveCount).toBe(1);
    expect(result.current.sourceBottleIndex).toBeNull();
  });

  test("ゲーム核が拒否する注ぎ先では盤面と手数を変更しないこと", () => {
    const { result } = renderHook(() => useWaterSortGame("easy"));
    const legalMove = listWaterSortLegalMoves(result.current.state)[0];
    expect(legalMove).toBeDefined();
    if (!legalMove) {
      return;
    }
    const initialState = result.current.state;

    act(() => result.current.selectBottle(legalMove.sourceBottleIndex));
    const illegalDestination = result.current.state.findIndex(
      (_, bottleIndex) =>
        bottleIndex !== legalMove.sourceBottleIndex &&
        applyWaterSortMove(result.current.state, {
          sourceBottleIndex: legalMove.sourceBottleIndex,
          destinationBottleIndex: bottleIndex,
        }) === null,
    );
    expect(illegalDestination).toBeGreaterThanOrEqual(0);
    act(() => result.current.selectBottle(illegalDestination));

    expect(result.current.state).toEqual(initialState);
    expect(result.current.moveCount).toBe(0);
    expect(result.current.sourceBottleIndex).toBe(legalMove.sourceBottleIndex);
    expect(result.current.selectionResult).toMatchObject({
      type: "invalid",
      bottleIndex: illegalDestination,
    });
  });

  test("元に戻して盤面を復元しても成立済みの注水手数を減らさないこと", () => {
    const { result } = renderHook(() => useWaterSortGame("easy"));
    const initialState = result.current.state;
    const move = listWaterSortLegalMoves(initialState)[0];
    expect(move).toBeDefined();
    if (!move) {
      return;
    }

    performMove(result, move);
    act(() => result.current.undo());

    expect(result.current.state).toEqual(initialState);
    expect(result.current.moveCount).toBe(1);
    expect(result.current.undoCount).toBe(1);
    expect(result.current.canUndo).toBe(false);
  });

  test("元に戻せる履歴がない操作は回数へ含めないこと", () => {
    const { result } = renderHook(() => useWaterSortGame("easy"));

    act(() => result.current.undo());

    expect(result.current.undoCount).toBe(0);
    expect(result.current.canUndo).toBe(false);
  });

  test("プレイ中のやり直しは同じ問題へ戻し手数と経過時間を累積すること", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-16T00:00:00Z"));
    const { result } = renderHook(() => useWaterSortGame("easy"));
    const initialState = result.current.state;
    const initialSeed = result.current.seed;
    const move = listWaterSortLegalMoves(initialState)[0];
    expect(move).toBeDefined();
    if (!move) {
      return;
    }

    performMove(result, move);
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.restart());

    expect(result.current.state).toEqual(initialState);
    expect(result.current.seed).toBe(initialSeed);
    expect(result.current.moveCount).toBe(1);
    expect(result.current.restartCount).toBe(1);
    expect(result.current.elapsedMs).toBe(3000);
    expect(result.current.canUndo).toBe(false);
  });

  test("新しい問題では別シードへ切り替えてプレイ成績を初期化すること", () => {
    const { result } = renderHook(() => useWaterSortGame("easy"));
    const initialSeed = result.current.seed;
    const move = listWaterSortLegalMoves(result.current.state)[0];
    expect(move).toBeDefined();
    if (!move) {
      return;
    }
    performMove(result, move);
    act(() => result.current.undo());
    act(() => result.current.restart());

    act(() => result.current.newGame());

    expect(result.current.seed).not.toBe(initialSeed);
    expect(result.current.moveCount).toBe(0);
    expect(result.current.undoCount).toBe(0);
    expect(result.current.restartCount).toBe(0);
  });

  test("盤面が完成すると自動でプレイを終了して最短手数との差を成績化すること", () => {
    const { result } = renderHook(() => useWaterSortGame("easy"));

    solveCurrentProblem(result);

    expect(result.current.status).toBe("cleared");
    expect(result.current.phase).toBe("clearing");
    expect(result.current.selectionResult).toMatchObject({
      type: "poured",
      isClearingMove: true,
    });
    expect(result.current.result).toEqual({
      elapsedMs: expect.any(Number),
      moveCount: result.current.optimalMoveCount,
      undoCount: 0,
      restartCount: 0,
      optimalMoveCount: result.current.optimalMoveCount,
      moveDelta: 0,
      score: 100,
    });
  });

  test("最終注水の演出完了を受け取ると結果表示へ進むこと", () => {
    const { result } = renderHook(() => useWaterSortGame("easy"));
    solveCurrentProblem(result);

    act(() => result.current.completeClearPresentation());

    expect(result.current.phase).toBe("result");
  });

  test("クリア後に同じ問題へ再挑戦すると同じシードで別プレイとして計測すること", () => {
    const { result } = renderHook(() => useWaterSortGame("easy"));
    const initialState = result.current.state;
    const initialSeed = result.current.seed;
    solveCurrentProblem(result);
    expect(result.current.status).toBe("cleared");

    act(() => result.current.restart());

    expect(result.current.status).toBe("playing");
    expect(result.current.state).toEqual(initialState);
    expect(result.current.seed).toBe(initialSeed);
    expect(result.current.moveCount).toBe(0);
    expect(result.current.undoCount).toBe(0);
    expect(result.current.restartCount).toBe(0);
    expect(result.current.result).toBeNull();
  });
});
