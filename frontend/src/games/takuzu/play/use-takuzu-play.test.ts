import { act, cleanup, renderHook } from "@testing-library/react";

import { useTakuzuPlay } from "@/games/takuzu/play/use-takuzu-play";
import { takuzuFixedProblem } from "@/games/takuzu/problem/fixed-problem";

type HookResult = { current: ReturnType<typeof useTakuzuPlay> };

const firstEmptyCellIndex = takuzuFixedProblem.givens.cells.indexOf(null);

/** 解のタイルになるまで各空きマスを押す手順。A は1回、B は2回押す。 */
const solvingPresses = takuzuFixedProblem.givens.cells.flatMap(
  (cell, cellIndex) => {
    if (cell !== null) {
      return [];
    }
    return takuzuFixedProblem.solution.cells[cellIndex] === "a"
      ? [cellIndex]
      : [cellIndex, cellIndex];
  },
);

function pressAll(result: HookResult, cellIndices: readonly number[]): void {
  for (const cellIndex of cellIndices) {
    act(() => result.current.cycleCell(cellIndex, "forward"));
  }
}

afterEach(() => {
  cleanup();
});

describe("useTakuzuPlay", () => {
  let result: HookResult;

  beforeEach(() => {
    ({ result } = renderHook(() => useTakuzuPlay("3")));
  });

  test("固定問題の 8×8 盤面でプレイを始めること", () => {
    const { size, cells, status, difficulty } = result.current;

    expect(size).toBe(8);
    expect(cells).toHaveLength(64);
    expect(status).toBe("playing");
    expect(difficulty).toBe("3");
  });

  test("空きマスを押すとタイルを置くこと", () => {
    act(() => result.current.cycleCell(firstEmptyCellIndex, "forward"));

    expect(result.current.cells[firstEmptyCellIndex]?.cell).toBe("a");
  });

  describe("空きマスへタイルを置いた場合", () => {
    beforeEach(() => {
      act(() => result.current.cycleCell(firstEmptyCellIndex, "forward"));
    });

    test("やり直すと初期配置へ戻すこと", () => {
      act(() => result.current.restart());

      expect(result.current.cells[firstEmptyCellIndex]?.cell).toBeNull();
    });
  });

  describe("全マスを解のとおりに置いた場合", () => {
    beforeEach(() => {
      pressAll(result, solvingPresses);
    });

    test("クリアしてプレイ事実を返すこと", () => {
      const { status, sessionResult } = result.current;

      expect(status).toBe("cleared");
      expect(sessionResult).toMatchObject({
        correctionCount: 0,
        restartCount: 0,
        inputCount: solvingPresses.length,
      });
    });

    test("同じ問題をもう一度始めると初期配置のプレイ中へ戻ること", () => {
      act(() => result.current.replay());

      expect(result.current.status).toBe("playing");
      expect(result.current.cells[firstEmptyCellIndex]?.cell).toBeNull();
      expect(result.current.sessionResult).toBeNull();
    });
  });
});
