import { act, cleanup, renderHook } from "@testing-library/react";

import { useNonogramPlay } from "@/games/nonogram/play/use-nonogram-play";
import { selectNonogramProblemForDifficulty } from "@/games/nonogram/problem-selection";
import type { NonogramPattern } from "@/games/nonogram/puzzle/pattern";
import type { NonogramMark } from "@/games/nonogram/session/session";
import { createProblemId } from "@/games/problem-id";
import { createProblemSeed } from "@/games/problem-seed";

vi.mock("@/games/problem-seed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/games/problem-seed")>()),
  createProblemSeed: vi.fn(),
}));

type HookResult = { current: ReturnType<typeof useNonogramPlay> };

const difficulty = "1";
const initialSeed = "use-nonogram-play-a";
const otherSeed = "use-nonogram-play-b";
const initial = selectNonogramProblemForDifficulty(difficulty, initialSeed);
const other = selectNonogramProblemForDifficulty(difficulty, otherSeed);
const { solution } = initial.problem;
const firstBlackCellIndex = solution.black.indexOf(true);
const firstWhiteCellIndex = solution.black.indexOf(false);

function listBlackCellIndices(pattern: NonogramPattern): number[] {
  return pattern.black.flatMap((isBlack, cellIndex) =>
    isBlack ? [cellIndex] : [],
  );
}

function tap(
  result: HookResult,
  cellIndex: number,
  mark: NonogramMark = "filled",
): void {
  act(() => result.current.startStroke(cellIndex, mark));
  act(() => result.current.endStroke());
}

function fillSolution(result: HookResult): void {
  for (const cellIndex of listBlackCellIndices(solution)) {
    tap(result, cellIndex);
  }
}

afterEach(() => {
  cleanup();
  vi.mocked(createProblemSeed).mockReset();
});

describe("useNonogramPlay", () => {
  describe("難易度だけを渡した場合", () => {
    let result: HookResult;

    beforeEach(() => {
      vi.mocked(createProblemSeed)
        .mockReturnValueOnce(initialSeed)
        .mockReturnValueOnce(otherSeed);
      ({ result } = renderHook(() => useNonogramPlay(difficulty)));
    });

    test("seed で選んだ問題の未確定の盤面とヒントでプレイを始めること", () => {
      const { board, clues, progress, problemIdentity } = result.current;

      expect(board.cells.every((state) => state === "unknown")).toBe(true);
      expect(clues).toEqual(initial.problem.clues);
      expect(progress).toBe("playing");
      expect(problemIdentity).toEqual(initial.identity);
    });

    describe("操作する前の場合", () => {
      test("操作を知らせないこと", () => {
        const { operation } = result.current;

        expect(operation).toBeNull();
      });
    });

    describe("未確定のマスを押した場合", () => {
      const markedCases = [["filled"], ["crossed"]] as const;

      test.each(markedCases)(
        "%s の印で押すと、その印を入れたことを知らせること",
        (mark) => {
          tap(result, firstBlackCellIndex, mark);

          expect(result.current.operation).toMatchObject({
            type: "marked",
            mark,
          });
        },
      );
    });

    describe("塗ったマスがある場合", () => {
      beforeEach(() => {
        tap(result, firstBlackCellIndex);
      });

      test("同じ印で押すと印を消したことを、別の id で知らせること", () => {
        const firstId = result.current.operation?.id;

        tap(result, firstBlackCellIndex);

        expect(result.current.operation?.type).toBe("erased");
        expect(result.current.operation?.id).not.toBe(firstId);
      });

      test("待ったで直前の入力を取り消すこと", () => {
        act(() => result.current.undo());

        expect(result.current.board.cells[firstBlackCellIndex]).toBe("unknown");
        expect(result.current.canUndo).toBe(false);
      });

      test("待ったで操作の知らせを消すこと", () => {
        act(() => result.current.undo());

        expect(result.current.operation).toBeNull();
      });

      test("盤面を戻すで操作の知らせを消すこと", () => {
        act(() => result.current.restart());

        expect(result.current.operation).toBeNull();
      });
    });

    describe("マスを押した場合", () => {
      beforeEach(() => {
        act(() => result.current.startStroke(firstBlackCellIndex, "filled"));
      });

      test("押している間は入力の範囲を返すこと", () => {
        const { strokeRange } = result.current;

        expect(strokeRange).toEqual({
          startCellIndex: firstBlackCellIndex,
          endCellIndex: firstBlackCellIndex,
        });
      });

      test("離すと入力を終え、待ったと盤面を戻すを使えるようにすること", () => {
        act(() => result.current.endStroke());

        expect(result.current.strokeRange).toBeNull();
        expect(result.current.board.cells[firstBlackCellIndex]).toBe("filled");
        expect(result.current.canUndo).toBe(true);
        expect(result.current.canRestart).toBe(true);
      });
    });

    describe("1行の塗りをすべて入れた場合", () => {
      const row = Math.floor(firstBlackCellIndex / solution.width);
      const rowCells = listBlackCellIndices(solution).filter(
        (cellIndex) => Math.floor(cellIndex / solution.width) === row,
      );

      beforeEach(() => {
        for (const cellIndex of rowCells) {
          tap(result, cellIndex);
        }
      });

      test("その行をヒントにちょうど合った行として返すこと", () => {
        const { matchedLines } = result.current;

        expect(matchedLines.rows[row]).toBe(true);
      });
    });

    describe("塗りが図柄と一致した場合", () => {
      beforeEach(() => {
        fillSolution(result);
      });

      test("完成演出へ進み、経過時間を止め、問題の作業の量で評価した結果を返すこと", () => {
        const {
          progress,
          status,
          completedAt,
          result: playResult,
        } = result.current;

        expect(progress).toBe("clearing");
        expect(status).toBe("cleared");
        expect(completedAt).not.toBeNull();
        expect(playResult).toMatchObject({
          repaintCount: 0,
          workload: initial.workload,
          score: { total: 100 },
        });
      });

      test("完成演出を終えると結果へ進むこと", () => {
        act(() => result.current.completeClearAnimation());

        expect(result.current.progress).toBe("result");
      });

      test("リセットで同じ問題を未確定の盤面から始め直すこと", () => {
        act(() => result.current.replay());

        expect(result.current.progress).toBe("playing");
        expect(result.current.problemIdentity).toEqual(initial.identity);
        expect(
          result.current.board.cells.every((state) => state === "unknown"),
        ).toBe(true);
      });
    });

    describe("塗りを待ったで取り消してから解いた場合", () => {
      beforeEach(() => {
        tap(result, firstBlackCellIndex);
        act(() => result.current.undo());
        fillSolution(result);
      });

      test("待ったで消えた塗りを塗り直しに数えて減点し、待ったの回数では減点しないこと", () => {
        const playResult = result.current.result;

        expect(playResult).toMatchObject({ repaintCount: 1, undoCount: 1 });
        expect(playResult?.score.breakdown).toEqual({ speed: 85, accuracy: 12 });
      });
    });

    describe("塗りを消してから盤面を戻して解いた場合", () => {
      beforeEach(() => {
        tap(result, firstBlackCellIndex);
        tap(result, firstBlackCellIndex);
        tap(result, firstBlackCellIndex);
        act(() => result.current.restart());
        fillSolution(result);
      });

      test("盤面を戻す前の塗り直しを引き継ぎ、盤面を戻して消えた塗りと盤面を戻した回数では減点しないこと", () => {
        const playResult = result.current.result;

        expect(playResult).toMatchObject({ repaintCount: 1, restartCount: 1 });
        expect(playResult?.score.breakdown).toEqual({ speed: 85, accuracy: 12 });
      });
    });

    describe("× を付け外ししてから解いた場合", () => {
      beforeEach(() => {
        tap(result, firstWhiteCellIndex, "crossed");
        tap(result, firstWhiteCellIndex, "crossed");
        tap(result, firstWhiteCellIndex, "crossed");
        act(() => result.current.undo());
        fillSolution(result);
      });

      test("× の付け外しを数えるが、減点しないこと", () => {
        const playResult = result.current.result;

        expect(playResult).toMatchObject({
          repaintCount: 0,
          crossToggleCount: 3,
        });
        expect(playResult?.score.breakdown).toEqual({ speed: 85, accuracy: 15 });
      });
    });

    test("別の問題で、今の問題を避けて別の seed の問題を始めること", () => {
      act(() => result.current.startNewProblem());

      expect(createProblemId(result.current.problemIdentity)).not.toBe(
        createProblemId(initial.identity),
      );
      expect(result.current.problemIdentity).toEqual(other.identity);
    });
  });

  describe("始める問題を渡した場合", () => {
    let result: HookResult;

    beforeEach(() => {
      ({ result } = renderHook(() => useNonogramPlay(difficulty, other)));
    });

    test("seed を引かずにその問題でプレイを始めること", () => {
      const { problemIdentity, clues } = result.current;

      expect(createProblemSeed).not.toHaveBeenCalled();
      expect(problemIdentity).toEqual(other.identity);
      expect(clues).toEqual(other.problem.clues);
    });
  });

  describe("最初の seed が避ける問題を指す場合", () => {
    let result: HookResult;

    beforeEach(() => {
      vi.mocked(createProblemSeed)
        .mockReturnValueOnce(initialSeed)
        .mockReturnValueOnce(otherSeed);
      ({ result } = renderHook(() =>
        useNonogramPlay(
          difficulty,
          undefined,
          createProblemId(initial.identity),
        ),
      ));
    });

    test("seed を引き直して避ける問題とは別の問題で始めること", () => {
      const { problemIdentity } = result.current;

      expect(other.identity).not.toEqual(initial.identity);
      expect(problemIdentity).toEqual(other.identity);
    });
  });
});
