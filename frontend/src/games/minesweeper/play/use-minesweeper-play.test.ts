import {
  act,
  cleanup,
  type RenderHookResult,
  renderHook,
} from "@testing-library/react";

import { isInMinesweeperDifficultyBoardRange } from "@/games/minesweeper/difficulty";
import { useMinesweeperPlay } from "@/games/minesweeper/play/use-minesweeper-play";
import { restoreMinesweeperProblemWithoutAnalysis } from "@/games/minesweeper/problem/generator";
import {
  listMinesweeperPoolEntries,
  toMinesweeperPoolIdentity,
} from "@/games/minesweeper/problem/problem-pool";

afterEach(cleanup);

type MinesweeperPlayHook = RenderHookResult<
  ReturnType<typeof useMinesweeperPlay>,
  unknown
>;
type HookVisibleCells = ReturnType<typeof useMinesweeperPlay>["visibleCells"];

describe("useMinesweeperPlay", () => {
  describe("難易度だけを渡した場合", () => {
    let hook: MinesweeperPlayHook;

    beforeEach(() => {
      hook = renderHook(() => useMinesweeperPlay("3"));
    });

    test("seedを生成してその難易度の問題集から選んだ問題を始めること", () => {
      const play = hook.result.current;

      expect(play.seed).not.toBe("");
      expect(
        isInMinesweeperDifficultyBoardRange(
          "3",
          play.problemIdentity.conditions,
        ),
      ).toBe(true);
      expect([play.rows, play.columns, play.mineCount]).toEqual([
        play.problemIdentity.conditions.rows,
        play.problemIdentity.conditions.columns,
        play.problemIdentity.conditions.mineCount,
      ]);
      expect(play.status).toBe("playing");
    });
  });

  describe("再現用情報を渡した場合", () => {
    const identity = toMinesweeperPoolIdentity(
      "5",
      listMinesweeperPoolEntries("5")[0]!,
    );
    const { problem } = restoreMinesweeperProblemWithoutAnalysis(identity);
    const initialRevealedCellIndices = [
      ...problem.initialRevealedCellIndices,
    ].sort((left, right) => left - right);
    const hiddenSafeCellIndex = Array.from(
      { length: problem.board.rows * problem.board.columns },
      (_, cellIndex) => cellIndex,
    ).find(
      (cellIndex) =>
        !problem.board.mineCellIndices.includes(cellIndex) &&
        !initialRevealedCellIndices.includes(cellIndex),
    )!;
    const hiddenMineCellIndex = problem.board.mineCellIndices[0]!;
    let hook: MinesweeperPlayHook;

    beforeEach(() => {
      hook = renderHook(() => useMinesweeperPlay("5", identity));
    });

    test("その問題を初期開示から始めること", () => {
      const play = hook.result.current;

      expect(play.problemIdentity).toEqual(identity);
      expect(play.seed).toBe(identity.seed);
      expect(
        play.visibleCells.flatMap((cell, cellIndex) =>
          cell.state === "revealed" ? [cellIndex] : [],
        ),
      ).toEqual(initialRevealedCellIndices);
    });

    describe("マスを開いた後の場合", () => {
      let initialVisibleCells: HookVisibleCells;

      beforeEach(() => {
        initialVisibleCells = hook.result.current.visibleCells;
        act(() => hook.result.current.revealCell(hiddenSafeCellIndex));
      });

      test("リセットで同じ問題を初期状態からやり直すこと", () => {
        act(() => hook.result.current.replay());

        const play = hook.result.current;

        expect(play.problemIdentity).toEqual(identity);
        expect(play.visibleCells).toEqual(initialVisibleCells);
        expect(play.status).toBe("playing");
      });
    });

    describe("地雷を踏んだ後の場合", () => {
      beforeEach(() => {
        act(() => hook.result.current.revealCell(hiddenMineCellIndex));
      });

      test("プレイを続けてミスを数えること", () => {
        const play = hook.result.current;

        expect(play.status).toBe("playing");
        expect(play.mistakeCount).toBe(1);
        expect(play.visibleCells[hiddenMineCellIndex]).toEqual({
          state: "steppedMine",
        });
      });

      test("リセットでミスを数え直すこと", () => {
        act(() => hook.result.current.replay());

        expect(hook.result.current.mistakeCount).toBe(0);
      });
    });

    test("別の問題で同じ難易度の異なる問題を始めること", () => {
      act(() => hook.result.current.startNewProblem());

      const play = hook.result.current;

      expect(play.problemIdentity.seed).not.toBe(identity.seed);
      expect(play.seed).not.toBe(identity.seed);
      expect(
        isInMinesweeperDifficultyBoardRange(
          "5",
          play.problemIdentity.conditions,
        ),
      ).toBe(true);
    });
  });
});
