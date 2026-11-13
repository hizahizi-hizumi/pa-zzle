import { act, cleanup, renderHook } from "@testing-library/react";

import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import { useNanpurePlay } from "@/games/nanpure/play/use-nanpure-play";
import { selectNanpureProblemForDifficulty } from "@/games/nanpure/problem-selection";
import * as problemSeed from "@/games/problem-seed";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type HookResult = ReturnType<typeof useNanpurePlay>;

describe("useNanpurePlay", () => {
  const difficultyCases = [
    ["1", "nanpure-selection-1"],
    ["3", "nanpure-selection-3"],
    ["5", "nanpure-selection-5"],
  ] as const;

  describe.each(difficultyCases)("レベル %s の場合", (difficulty, seed) => {
    const expected = selectNanpureProblemForDifficulty(difficulty, seed);
    let result: { current: HookResult };

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue(seed);
      ({ result } = renderHook(() => useNanpurePlay(difficulty)));
    });

    test("その難易度の問題集から選んだ問題でプレイを開始すること", () => {
      const { clues, problemIdentity } = result.current;

      expect(problemIdentity).toEqual(expected.identity);
      expect(clues).toEqual(expected.problem.clues);
    });
  });

  describe("再プレイする問題を渡した場合", () => {
    const initialProblem = selectNanpureProblemForDifficulty("4", "replayed");
    let result: { current: HookResult };

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue("other");
      ({ result } = renderHook(() => useNanpurePlay("4", initialProblem)));
    });

    test("渡した問題でプレイを開始すること", () => {
      const { problemIdentity } = result.current;

      expect(problemIdentity).toEqual(initialProblem.identity);
    });
  });

  describe("新しい問題を開始する場合", () => {
    const initialProps: { difficulty: NanpureDifficulty } = {
      difficulty: "1",
    };
    const expected = selectNanpureProblemForDifficulty("5", "nanpure-next");
    let result: { current: HookResult };
    let rerender: (props: { difficulty: NanpureDifficulty }) => void;

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed")
        .mockReturnValueOnce("nanpure-first")
        .mockReturnValue("nanpure-next");
      ({ result, rerender } = renderHook(
        ({ difficulty }: { difficulty: NanpureDifficulty }) =>
          useNanpurePlay(difficulty),
        { initialProps },
      ));
    });

    test("現在選択中の難易度の問題集から選び直すこと", () => {
      rerender({ difficulty: "5" });
      act(() => result.current.startNewProblem());
      const { problemIdentity } = result.current;

      expect(problemIdentity).toEqual(expected.identity);
    });
  });

  describe("空きマスを選んだ場合", () => {
    const { problem } = selectNanpureProblemForDifficulty(
      "2",
      "nanpure-selection-2",
    );
    const emptyCellIndex = problem.clues.indexOf(null);
    const correctDigit = problem.solution[emptyCellIndex] ?? 1;
    const wrongDigit = correctDigit === 1 ? 2 : 1;
    let result: { current: HookResult };

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue(
        "nanpure-selection-2",
      );
      ({ result } = renderHook(() => useNanpurePlay("2")));
      act(() => result.current.selectCell(emptyCellIndex));
    });

    test("操作する前は操作を知らせないこと", () => {
      const { operation } = result.current;

      expect(operation).toBeNull();
    });

    test("解の数字の入力を数字の入力として知らせること", () => {
      act(() => result.current.inputDigit(correctDigit));

      expect(result.current.operation?.type).toBe("digit-entered");
    });

    test("解と異なる数字の入力をミスに数えた入力として知らせること", () => {
      act(() => result.current.inputDigit(wrongDigit));

      expect(result.current.operation?.type).toBe("mistake-entered");
      expect(result.current.mistakeCount).toBe(1);
    });

    describe("解の数字を入れた場合", () => {
      let enteredOperation: HookResult["operation"];

      beforeEach(() => {
        act(() => result.current.inputDigit(correctDigit));
        enteredOperation = result.current.operation;
      });

      test("同じ数字の入力を操作として知らせないこと", () => {
        act(() => result.current.inputDigit(correctDigit));

        expect(result.current.operation).toBe(enteredOperation);
      });

      test("別の数字の入力に別の id を付けること", () => {
        act(() => result.current.inputDigit(wrongDigit));

        expect(result.current.operation?.id).not.toBe(enteredOperation?.id);
      });

      test("数字を消すと操作の知らせを消すこと", () => {
        act(() => result.current.erase());

        expect(result.current.operation).toBeNull();
      });

      test("待ったで操作の知らせを消すこと", () => {
        act(() => result.current.undo());

        expect(result.current.operation).toBeNull();
      });
    });

    describe("メモの入力に切り替えた場合", () => {
      beforeEach(() => {
        act(() => result.current.toggleNotesMode());
      });

      test("メモの書き込みをメモの追加として知らせること", () => {
        act(() => result.current.inputDigit(correctDigit));

        expect(result.current.operation?.type).toBe("note-added");
      });

      describe("メモを書いた場合", () => {
        beforeEach(() => {
          act(() => result.current.inputDigit(correctDigit));
        });

        test("同じ数字をもう一度押すとメモの削除として知らせること", () => {
          act(() => result.current.inputDigit(correctDigit));

          expect(result.current.operation?.type).toBe("note-removed");
        });
      });
    });
  });

  describe("行の最後の空きマスに解の数字を入れた場合", () => {
    const { problem } = selectNanpureProblemForDifficulty(
      "2",
      "nanpure-selection-2",
    );
    const emptyCellIndices = problem.clues.flatMap((cell, cellIndex) =>
      cell === null && cellIndex < 9 ? [cellIndex] : [],
    );
    const lastCellIndex = emptyCellIndices.at(-1) ?? 0;
    let result: { current: HookResult };

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue(
        "nanpure-selection-2",
      );
      ({ result } = renderHook(() => useNanpurePlay("2")));
      for (const cellIndex of emptyCellIndices.slice(0, -1)) {
        act(() => result.current.selectCell(cellIndex));
        act(() => result.current.inputDigit(problem.solution[cellIndex] ?? 1));
      }
      act(() => result.current.selectCell(lastCellIndex));
    });

    test("埋まりきった行を知らせること", () => {
      act(() =>
        result.current.inputDigit(problem.solution[lastCellIndex] ?? 1),
      );
      const { operation } = result.current;

      expect(
        operation?.type === "digit-entered" ? operation.completedUnits : null,
      ).toContainEqual({ kind: "row", index: 0 });
    });
  });

  describe("数字を固めた場合", () => {
    const { problem } = selectNanpureProblemForDifficulty(
      "2",
      "nanpure-selection-2",
    );
    const emptyCellIndex = problem.clues.indexOf(null);
    const lockedDigit = problem.solution[emptyCellIndex] ?? 1;
    const otherDigit = lockedDigit === 1 ? 2 : 1;
    const clueCellIndex = problem.clues.findIndex((cell) => cell !== null);
    let result: { current: HookResult };

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue(
        "nanpure-selection-2",
      );
      ({ result } = renderHook(() => useNanpurePlay("2")));
      act(() => result.current.lockDigit(lockedDigit));
    });

    test("マスを押すだけで固めた数字を置くこと", () => {
      act(() => result.current.selectCell(emptyCellIndex));
      const { board, selectedCellIndex, operation } = result.current;

      expect(board[emptyCellIndex]).toBe(lockedDigit);
      expect(selectedCellIndex).toBe(emptyCellIndex);
      expect(operation?.type).toBe("digit-entered");
    });

    test("初期ヒントのマスは選ぶだけにすること", () => {
      act(() => result.current.selectCell(clueCellIndex));
      const { board, selectedCellIndex } = result.current;

      expect(board[clueCellIndex]).toBe(problem.clues[clueCellIndex]);
      expect(selectedCellIndex).toBe(clueCellIndex);
    });

    describe("数字を置いたマスへ別の数字を固めた場合", () => {
      beforeEach(() => {
        act(() => result.current.selectCell(emptyCellIndex));
        act(() => result.current.inputDigit(otherDigit));
      });

      test("そのマスを押しても数字を変えずに選ぶだけにすること", () => {
        act(() => result.current.selectCell(emptyCellIndex));
        const { board, selectedCellIndex, mistakeCount } = result.current;

        expect(board[emptyCellIndex]).toBe(lockedDigit);
        expect(selectedCellIndex).toBe(emptyCellIndex);
        expect(mistakeCount).toBe(0);
      });
    });

    test("固めた数字をもう一度押すと固めを解くこと", () => {
      act(() => result.current.inputDigit(lockedDigit));
      act(() => result.current.selectCell(emptyCellIndex));
      const { lockedDigit: currentLockedDigit, board } = result.current;

      expect(currentLockedDigit).toBeNull();
      expect(board[emptyCellIndex]).toBeNull();
    });

    test("別の数字を押すと固める数字を替えること", () => {
      act(() => result.current.inputDigit(otherDigit));
      const { lockedDigit: currentLockedDigit } = result.current;

      expect(currentLockedDigit).toBe(otherDigit);
    });

    describe("メモの入力に切り替えた場合", () => {
      beforeEach(() => {
        act(() => result.current.toggleNotesMode());
      });

      test("マスを押すと固めた数字のメモを付けること", () => {
        act(() => result.current.selectCell(emptyCellIndex));
        const { notes, board } = result.current;

        expect(notes[emptyCellIndex]).toEqual([lockedDigit]);
        expect(board[emptyCellIndex]).toBeNull();
      });
    });
  });

  describe("盤面を完成させる場合", () => {
    const { solution } = selectNanpureProblemForDifficulty(
      "2",
      "nanpure-selection-2",
    ).problem;
    let result: { current: HookResult };

    beforeEach(() => {
      vi.spyOn(problemSeed, "createProblemSeed").mockReturnValue(
        "nanpure-selection-2",
      );
      ({ result } = renderHook(() => useNanpurePlay("2")));
    });

    test("完成状態を見せてから結果表示へ進めること", () => {
      for (const [cellIndex, digit] of solution.entries()) {
        if (result.current.board[cellIndex] !== null) continue;
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
});
