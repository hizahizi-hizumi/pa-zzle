import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { useWaterSortGame } from "./use-water-sort-game";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useWaterSortGame", () => {
  test("プレイ中の経過時間を計測しクリア後に固定すること", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T12:00:00Z"));
    const { result } = renderHook(() => useWaterSortGame("normal"));

    act(() => vi.advanceTimersByTime(3000));
    const playingElapsedMs = result.current.elapsedMs;
    act(() => result.current.complete());
    const clearedElapsedMs = result.current.elapsedMs;
    act(() => vi.advanceTimersByTime(5000));

    expect(playingElapsedMs).toBe(3000);
    expect(clearedElapsedMs).toBe(3000);
    expect(result.current.elapsedMs).toBe(3000);
    expect(result.current.status).toBe("cleared");
    expect(result.current.result).toEqual({
      elapsedMs: 3000,
      moveCount: 0,
      undoCount: 0,
      restartCount: 0,
    });
  });

  test("注ぎ元と注ぎ先を順に選択できること", () => {
    const { result } = renderHook(() => useWaterSortGame("normal"));

    act(() => result.current.selectBottle("bottle-a"));
    const sourceSelection = {
      sourceBottleId: result.current.sourceBottleId,
      targetBottleId: result.current.targetBottleId,
    };
    act(() => result.current.selectBottle("bottle-b"));
    const targetSelection = {
      sourceBottleId: result.current.sourceBottleId,
      targetBottleId: result.current.targetBottleId,
    };
    act(() => result.current.selectBottle("bottle-c"));

    expect(sourceSelection).toEqual({
      sourceBottleId: "bottle-a",
      targetBottleId: null,
    });
    expect(targetSelection).toEqual({
      sourceBottleId: "bottle-a",
      targetBottleId: "bottle-b",
    });
    expect(result.current.sourceBottleId).toBe("bottle-c");
    expect(result.current.targetBottleId).toBeNull();
  });

  test("手数と元に戻した回数を独立して記録すること", () => {
    const { result } = renderHook(() => useWaterSortGame("normal"));

    act(() => result.current.recordMove());
    act(() => result.current.recordMove());
    act(() => result.current.undo());
    act(() => result.current.undo());
    act(() => result.current.undo());

    expect(result.current.moveCount).toBe(2);
    expect(result.current.undoCount).toBe(2);
    expect(result.current.canUndo).toBe(false);
  });

  test("やり直しと新しい問題の開始を別操作として扱うこと", () => {
    const { result } = renderHook(() => useWaterSortGame("normal"));
    const initialSeed = result.current.seed;

    act(() => result.current.recordMove());
    act(() => result.current.restart());
    const restarted = {
      seed: result.current.seed,
      moveCount: result.current.moveCount,
      restartCount: result.current.restartCount,
      canUndo: result.current.canUndo,
    };
    act(() => result.current.newGame());

    expect(restarted).toEqual({
      seed: initialSeed,
      moveCount: 1,
      restartCount: 1,
      canUndo: false,
    });
    expect(result.current.seed).not.toBe(initialSeed);
    expect(result.current.moveCount).toBe(0);
    expect(result.current.undoCount).toBe(0);
    expect(result.current.restartCount).toBe(0);
  });
});
