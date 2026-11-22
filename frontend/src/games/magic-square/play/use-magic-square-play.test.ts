import { act, cleanup, renderHook } from "@testing-library/react";

import { useMagicSquarePlay } from "@/games/magic-square/play/use-magic-square-play";
import { selectMagicSquareProblemForDifficulty } from "@/games/magic-square/problem-selection";
import { calculateMagicSquareSpeedScoreRule } from "@/games/magic-square/score";
import { createProblemId } from "@/games/problem-id";
import { createProblemSeed } from "@/games/problem-seed";

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: vi.fn(),
}));

type HookResult = { current: ReturnType<typeof useMagicSquarePlay> };

const difficulty = "1";
const initial = selectMagicSquareProblemForDifficulty(difficulty, "any");
/** レベル1の問題の答え。空きマスと、そこに入る数。 */
const solvingEntries = [
  [0, 14],
  [3, 11],
  [4, 9],
  [6, 7],
  [7, 16],
  [8, 8],
  [9, 13],
  [13, 15],
] as const;

function place(result: HookResult, cellIndex: number, value: number): void {
  act(() => result.current.selectCell(cellIndex));
  act(() => result.current.enterValue(value));
}

afterEach(() => {
  cleanup();
  vi.mocked(createProblemSeed).mockReset();
  window.sessionStorage.clear();
});

describe("useMagicSquarePlay", () => {
  describe("難易度だけを渡した場合", () => {
    let result: HookResult;

    beforeEach(() => {
      vi.mocked(createProblemSeed).mockReturnValue("use-magic-square-play");
      ({ result } = renderHook(() => useMagicSquarePlay(difficulty)));
    });

    test("問題集から選んだ問題の盤面で、どのマスも選ばずにプレイを始めること", () => {
      const { board, selectedCellIndex, progress, problemIdentity } =
        result.current;

      expect({
        cells: board.cells,
        selectedCellIndex,
        progress,
        problemIdentity,
      }).toEqual({
        cells: initial.problem.givens.cells,
        selectedCellIndex: null,
        progress: "playing",
        problemIdentity: initial.identity,
      });
    });

    test("ほかのマスを選んでから戻って置き換えると取り下げを数えること", () => {
      place(result, 0, 13);
      act(() => result.current.selectCell(3));
      place(result, 0, 14);

      expect(result.current.withdrawalCount).toBe(1);
    });

    describe("左上のマスに14を置いた場合", () => {
      beforeEach(() => {
        place(result, 0, 14);
      });

      test("置いた数と、列の今の合計と、数の欄の状態を返すこと", () => {
        const { board, lineEvaluations, valueStates } = result.current;

        expect({
          cell: board.cells[0],
          firstRowSum: lineEvaluations[0]?.sum,
          state: valueStates[13],
        }).toEqual({ cell: 14, firstRowSum: 23, state: "selected" });
      });

      test("待ったで置いた数を取り消すこと", () => {
        act(() => result.current.undo());

        expect([result.current.board.cells[0], result.current.canUndo]).toEqual(
          [null, false],
        );
      });

      test("盤面を戻すと最初の盤面にすること", () => {
        act(() => result.current.restart());

        expect([result.current.board.cells, result.current.canRestart]).toEqual(
          [initial.problem.givens.cells, false],
        );
      });
    });

    describe("全部の空きを答えの数で埋めた場合", () => {
      beforeEach(() => {
        for (const [cellIndex, value] of solvingEntries) {
          place(result, cellIndex, value);
        }
      });

      test("完成演出へ進み、プレイの事実と評価を返すこと", () => {
        const { progress, status, result: playResult } = result.current;

        expect({
          progress,
          status,
          withdrawalCount: playResult?.withdrawalCount,
          speedRule: playResult?.speedRule,
          workload: playResult?.workload,
        }).toEqual({
          progress: "clearing",
          status: "cleared",
          withdrawalCount: 0,
          speedRule: calculateMagicSquareSpeedScoreRule({ emptyCellCount: 8 }),
          workload: { emptyCellCount: 8 },
        });
      });

      test("完成演出を終えると結果へ進むこと", () => {
        act(() => result.current.completeClearAnimation());

        expect(result.current.progress).toBe("result");
      });

      test("同じ問題をもう一度始めると最初の盤面のプレイ中へ戻ること", () => {
        act(() => result.current.replay());

        expect([result.current.progress, result.current.board.cells]).toEqual([
          "playing",
          initial.problem.givens.cells,
        ]);
      });

      test("クリア後はマスを選ばないこと", () => {
        act(() => result.current.selectCell(0));

        expect(result.current.selectedCellIndex).toBeNull();
      });
    });
  });

  describe("別の問題がある難易度の場合", () => {
    let result: HookResult;
    const otherDifficulty = "2";
    const seeds = ["other-a", "other-b", "other-c", "other-d"];
    const problemIds = seeds.map((seed) =>
      createProblemId(
        selectMagicSquareProblemForDifficulty(otherDifficulty, seed).identity,
      ),
    );

    beforeEach(() => {
      for (const seed of seeds) {
        vi.mocked(createProblemSeed).mockReturnValueOnce(seed);
      }
      vi.mocked(createProblemSeed).mockReturnValue("other-e");
      ({ result } = renderHook(() => useMagicSquarePlay(otherDifficulty)));
    });

    test("別の問題を選ぶと今と違う問題を始めること", () => {
      act(() => result.current.startNewProblem());

      expect(createProblemId(result.current.problemIdentity)).not.toBe(
        problemIds[0],
      );
    });
  });

  describe("記録から復元した問題を渡した場合", () => {
    let result: HookResult;
    const restored = selectMagicSquareProblemForDifficulty("5", "restored");

    beforeEach(() => {
      ({ result } = renderHook(() => useMagicSquarePlay("5", restored)));
    });

    test("seed を引かずにその問題でプレイを始めること", () => {
      const { problemIdentity } = result.current;

      expect([
        problemIdentity,
        vi.mocked(createProblemSeed).mock.calls,
      ]).toEqual([restored.identity, []]);
    });
  });
});
