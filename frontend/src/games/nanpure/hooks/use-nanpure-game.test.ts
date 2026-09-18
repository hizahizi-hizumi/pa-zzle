import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { findNanpureSolution } from "@/games/nanpure/game/solver";
import { useNanpureGame } from "./use-nanpure-game";

afterEach(cleanup);

describe("useNanpureGame", () => {
  test("盤面完成後に完成状態を見せてから結果表示へ進めること", () => {
    const { result } = renderHook(() => useNanpureGame("normal"));
    const solution = findNanpureSolution(result.current.board);
    expect(solution).not.toBeNull();
    if (!solution) {
      return;
    }

    for (const [cellIndex, digit] of solution.entries()) {
      if (result.current.board[cellIndex] !== null) {
        continue;
      }
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
