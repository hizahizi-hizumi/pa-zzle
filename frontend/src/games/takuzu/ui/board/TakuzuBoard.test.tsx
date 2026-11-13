import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";

import type { TakuzuOperation } from "@/games/takuzu/play/use-takuzu-play";
import type { TakuzuCell } from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import type {
  TakuzuCellView,
  TakuzuLineViolationView,
} from "@/games/takuzu/session/session";
import { TakuzuBoard } from "@/games/takuzu/ui/board/TakuzuBoard";

const cells: TakuzuCellView[] = [
  { cell: "a", given: true, inViolatingRun: false },
  { cell: null, given: false, inViolatingRun: false },
  { cell: "b", given: false, inViolatingRun: true },
  { cell: null, given: false, inViolatingRun: false },
];

const lineViolations: TakuzuLineViolationView[] = [
  { axis: "column", index: 1, overfilled: true, duplicated: false },
];

afterEach(() => {
  cleanup();
});

describe("TakuzuBoard", () => {
  let onCycleCell: ReturnType<
    typeof vi.fn<(cellIndex: number, direction: TakuzuCycleDirection) => void>
  >;
  let onPlaceCell: ReturnType<
    typeof vi.fn<(cellIndex: number, cell: TakuzuCell) => void>
  >;
  let board: HTMLElement;

  beforeEach(() => {
    onCycleCell =
      vi.fn<(cellIndex: number, direction: TakuzuCycleDirection) => void>();
    onPlaceCell = vi.fn<(cellIndex: number, cell: TakuzuCell) => void>();
  });

  describe("操作できる場合", () => {
    beforeEach(() => {
      render(
        <TakuzuBoard
          size={2}
          cells={cells}
          lineViolations={lineViolations}
          operation={null}
          interactionDisabled={false}
          onCycleCell={onCycleCell}
          onPlaceCell={onPlaceCell}
        />,
      );
      board = screen.getByRole("group", { name: "バイナリパズル盤面" });
    });

    test("マスの位置・中身・固定・違反の種類を名前で伝えること", () => {
      const result = within(board)
        .getAllByRole("button")
        .map((cell) => cell.getAttribute("aria-label"));

      expect(result).toEqual([
        "1行1列 0 固定",
        "1行2列 空き 列の個数超過",
        "2行1列 1 3連続",
        "2行2列 空き 列の個数超過",
      ]);
    });

    test("Tab で入る先を左上のマスひとつにすること", () => {
      const result = within(board)
        .getAllByRole("button")
        .map((cell) => cell.tabIndex);

      expect(result).toEqual([0, -1, -1, -1]);
    });

    test("盤面外へフォーカスが移ると行と列の案内を消すこと", () => {
      const cell = within(board).getByRole("button", { name: "1行1列 0 固定" });
      fireEvent.focus(cell);
      const readingBefore = document.querySelectorAll(
        ".takuzu-line-indicator[data-reading]",
      );

      fireEvent.blur(cell, { relatedTarget: null });
      const readingAfter = document.querySelectorAll(
        ".takuzu-line-indicator[data-reading]",
      );

      expect(readingBefore).toHaveLength(2);
      expect(readingAfter).toHaveLength(0);
    });

    test("タップで順方向の巡回を通知すること", () => {
      fireEvent.click(
        within(board).getByRole("button", { name: "1行2列 空き 列の個数超過" }),
      );

      expect(onCycleCell).toHaveBeenCalledWith(1, "forward");
    });

    test("右クリックで逆方向の巡回を通知すること", () => {
      fireEvent.contextMenu(
        within(board).getByRole("button", { name: "2行1列 1 3連続" }),
      );

      expect(onCycleCell).toHaveBeenCalledWith(2, "backward");
    });

    test("タッチの長押しでは逆方向の巡回を通知しないこと", () => {
      const cell = within(board).getByRole("button", {
        name: "2行1列 1 3連続",
      });

      fireEvent.pointerDown(cell, { pointerType: "touch" });
      fireEvent.contextMenu(cell);

      expect(onCycleCell).not.toHaveBeenCalled();
    });

    test("固定マスへのタップも巡回として通知し、通るかをプレイに任せること", () => {
      fireEvent.click(
        within(board).getByRole("button", { name: "1行1列 0 固定" }),
      );

      expect(onCycleCell).toHaveBeenCalledWith(0, "forward");
    });

    describe("左上のマスにフォーカスがある場合", () => {
      beforeEach(() => {
        act(() => {
          within(board).getByRole("button", { name: "1行1列 0 固定" }).focus();
        });
      });

      const arrowKeyCases = [
        ["ArrowRight", "1行2列 空き 列の個数超過"],
        ["ArrowDown", "2行1列 1 3連続"],
        ["ArrowLeft", "1行1列 0 固定"],
        ["ArrowUp", "1行1列 0 固定"],
      ] as const;

      test.each(arrowKeyCases)(
        "%s キーで %s のマスへフォーカスを移すこと",
        (key, expectedName) => {
          fireEvent.keyDown(document.activeElement ?? board, { key });
          const result = document.activeElement?.getAttribute("aria-label");

          expect(result).toBe(expectedName);
        },
      );

      test("固定マスへのキー入力も通知し、通るかをプレイに任せること", () => {
        fireEvent.keyDown(document.activeElement ?? board, { key: "1" });

        expect(onPlaceCell).toHaveBeenCalledWith(0, "b");
      });
    });

    describe("空きマスにフォーカスがある場合", () => {
      beforeEach(() => {
        act(() => {
          within(board)
            .getByRole("button", { name: "1行2列 空き 列の個数超過" })
            .focus();
        });
      });

      const tileKeyCases = [
        ["0", "a"],
        ["1", "b"],
      ] as const;

      test.each(tileKeyCases)(
        "%s キーでそのマスへ %s を置くよう通知すること",
        (key, expectedCell) => {
          fireEvent.keyDown(document.activeElement ?? board, { key });

          expect(onPlaceCell).toHaveBeenCalledWith(1, expectedCell);
        },
      );

      const clearKeys = ["Backspace", "Delete"];

      test.each(clearKeys)(
        "%s キーでそのマスを空きにするよう通知すること",
        (key) => {
          fireEvent.keyDown(document.activeElement ?? board, { key });

          expect(onPlaceCell).toHaveBeenCalledWith(1, null);
        },
      );

      test("フォーカスしたマスを Tab で入る先にすること", () => {
        const result = within(board)
          .getAllByRole("button")
          .map((cell) => cell.tabIndex);

        expect(result).toEqual([-1, 0, -1, -1]);
      });

      test("修飾キー付きのキー入力を盤面へ流さないこと", () => {
        fireEvent.keyDown(document.activeElement ?? board, {
          key: "1",
          ctrlKey: true,
        });

        expect(onPlaceCell).not.toHaveBeenCalled();
      });
    });
  });

  describe("数字盤面の状態表現", () => {
    const completedCells: TakuzuCellView[] = [
      { cell: "a", given: true, inViolatingRun: false },
      { cell: "b", given: false, inViolatingRun: false },
      { cell: "b", given: false, inViolatingRun: false },
      { cell: "a", given: false, inViolatingRun: false },
    ];

    function renderCompleted(
      violations: readonly TakuzuLineViolationView[] = [],
    ) {
      return render(
        <TakuzuBoard
          size={2}
          cells={completedCells}
          lineViolations={violations}
          operation={null}
          interactionDisabled={false}
          onCycleCell={onCycleCell}
          onPlaceCell={onPlaceCell}
        />,
      );
    }

    test("成立した行と列を両方向の完成インジケータで表示すること", () => {
      const { container } = renderCompleted();
      const completed = container.querySelectorAll(
        ".takuzu-line-indicator[data-completed]",
      );
      const signals = container.querySelectorAll(
        ".takuzu-completion-trace[data-completed]",
      );

      expect(completed).toHaveLength(4);
      expect(signals).toHaveLength(4);
    });

    test("違反している列を完成表示から除外すること", () => {
      const { container } = renderCompleted([
        { axis: "column", index: 1, overfilled: false, duplicated: true },
      ]);
      const completed = container.querySelectorAll(
        ".takuzu-line-indicator[data-completed]",
      );
      const signals = container.querySelectorAll(
        ".takuzu-completion-trace[data-completed]",
      );

      expect(completed).toHaveLength(3);
      expect(signals).toHaveLength(3);
    });

    test("数字が3連続した行を完成として表示しないこと", () => {
      const row = ["a", "a", "a", "b", "a", "b", "b", "b"] as const;
      const invalidCells: TakuzuCellView[] = Array.from(
        { length: 64 },
        (_, index) => ({
          cell: row[index] ?? null,
          given: false,
          inViolatingRun: index < 3 || (index >= 5 && index < 8),
        }),
      );
      const { container } = render(
        <TakuzuBoard
          size={8}
          cells={invalidCells}
          lineViolations={[]}
          operation={null}
          interactionDisabled={false}
          onCycleCell={onCycleCell}
          onPlaceCell={onPlaceCell}
        />,
      );
      const completed = container.querySelectorAll(
        ".takuzu-line-indicator[data-completed]",
      );

      expect(completed).toHaveLength(0);
    });

    test("選択したマスの行と列を盤面と外枠の両方で示すこと", () => {
      const { container } = renderCompleted();
      const board = screen.getByRole("group", { name: "バイナリパズル盤面" });
      fireEvent.focus(within(board).getByRole("button", { name: "1行2列 1" }));
      const reading = container.querySelectorAll(".takuzu-cell[data-reading]");
      const selected = container.querySelectorAll(
        ".takuzu-cell[data-selected]",
      );
      const indicators = container.querySelectorAll(
        ".takuzu-line-indicator[data-reading]",
      );

      expect(reading).toHaveLength(3);
      expect(selected).toHaveLength(1);
      expect(indicators).toHaveLength(2);
    });

    test("数字と固定マスの違いを読み上げ名で識別できること", () => {
      renderCompleted();
      const board = screen.getByRole("group", { name: "バイナリパズル盤面" });
      const labels = within(board)
        .getAllByRole("button")
        .map((cell) => cell.getAttribute("aria-label"));

      expect(labels).toEqual([
        "1行1列 0 固定",
        "1行2列 1",
        "2行1列 1",
        "2行2列 0",
      ]);
    });

    test("3連続と行列の違反を別々の表示で知らせること", () => {
      const { container } = render(
        <TakuzuBoard
          size={2}
          cells={cells}
          lineViolations={lineViolations}
          operation={null}
          interactionDisabled={false}
          onCycleCell={onCycleCell}
          onPlaceCell={onPlaceCell}
        />,
      );
      const violatingCell = container.querySelector(
        '.takuzu-cell[data-violated="true"]',
      );
      const lineMarkers = container.querySelectorAll(
        '[data-takuzu-line-warning=""]',
      );

      expect(
        violatingCell?.querySelector("[data-takuzu-run-warning]"),
      ).not.toBeNull();
      expect(lineMarkers).toHaveLength(8);
    });

    test("数字の0と1を直接入力し、Backspaceで消せること", () => {
      renderCompleted();
      const board = screen.getByRole("group", { name: "バイナリパズル盤面" });
      const cell = within(board).getByRole("button", { name: "1行2列 1" });
      fireEvent.focus(cell);
      fireEvent.keyDown(cell, { key: "0" });
      fireEvent.keyDown(cell, { key: "1" });
      fireEvent.keyDown(cell, { key: "Backspace" });
      fireEvent.keyDown(cell, { key: "2" });

      expect(onPlaceCell.mock.calls).toEqual([
        [1, "a"],
        [1, "b"],
        [1, null],
      ]);
    });

    test("個数が不均等な完成列を違反通知に依存せず未完成として扱うこと", () => {
      const unbalancedCells: TakuzuCellView[] = Array.from(
        { length: 4 },
        () => ({ cell: "a", given: false, inViolatingRun: false }),
      );
      const { container } = render(
        <TakuzuBoard
          size={2}
          cells={unbalancedCells}
          lineViolations={[]}
          operation={null}
          interactionDisabled={false}
          onCycleCell={onCycleCell}
          onPlaceCell={onPlaceCell}
        />,
      );
      const completed = container.querySelectorAll(
        ".takuzu-line-indicator[data-completed]",
      );

      expect(completed).toHaveLength(0);
    });
  });

  describe("固定マスへの操作が通らなかった場合", () => {
    let animate: ReturnType<typeof vi.fn>;
    let rerender: (ui: ReactNode) => void;

    function renderBoard(operation: TakuzuOperation | null) {
      return (
        <TakuzuBoard
          size={2}
          cells={cells}
          lineViolations={lineViolations}
          operation={operation}
          interactionDisabled={false}
          onCycleCell={onCycleCell}
          onPlaceCell={onPlaceCell}
        />
      );
    }

    beforeEach(() => {
      animate = vi.fn();
      Object.defineProperty(HTMLElement.prototype, "animate", {
        configurable: true,
        value: animate,
      });
      ({ rerender } = render(renderBoard(null)));
      board = screen.getByRole("group", { name: "バイナリパズル盤面" });
    });

    afterEach(() => {
      delete (HTMLElement.prototype as { animate?: Element["animate"] })
        .animate;
    });

    test("そのマスのタイルだけを揺らすこと", () => {
      rerender(renderBoard({ id: 1, type: "invalid", cellIndex: 0 }));
      const givenCell = within(board).getByRole("button", {
        name: "1行1列 0 固定",
      });

      expect(animate).toHaveBeenCalledOnce();
      expect(animate.mock.contexts[0]).toBe(
        givenCell.querySelector("[data-takuzu-tile]"),
      );
    });
  });

  describe("操作できない場合", () => {
    beforeEach(() => {
      render(
        <TakuzuBoard
          size={2}
          cells={cells}
          lineViolations={lineViolations}
          operation={null}
          interactionDisabled={true}
          onCycleCell={onCycleCell}
          onPlaceCell={onPlaceCell}
        />,
      );
      board = screen.getByRole("group", { name: "バイナリパズル盤面" });
    });

    test("空きマスを押しても通知しないこと", () => {
      fireEvent.click(
        within(board).getByRole("button", { name: "1行2列 空き 列の個数超過" }),
      );
      fireEvent.contextMenu(
        within(board).getByRole("button", { name: "2行2列 空き 列の個数超過" }),
      );

      expect(onCycleCell).not.toHaveBeenCalled();
    });

    test("キー入力を通知しないこと", () => {
      fireEvent.keyDown(
        within(board).getByRole("button", { name: "1行2列 空き 列の個数超過" }),
        { key: "1" },
      );

      expect(onPlaceCell).not.toHaveBeenCalled();
    });
  });
});
