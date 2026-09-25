import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TakuzuCell } from "@/games/takuzu/puzzle/board";
import type { TakuzuCycleDirection } from "@/games/takuzu/puzzle/transitions";
import type { TakuzuCellView } from "@/games/takuzu/session/session";
import { TakuzuBoard } from "@/games/takuzu/ui/board/TakuzuBoard";

const cells: TakuzuCellView[] = [
  { cell: "a", given: true, violated: false },
  { cell: null, given: false, violated: false },
  { cell: "b", given: false, violated: true },
  { cell: null, given: false, violated: false },
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
  let onClearingComplete: ReturnType<typeof vi.fn<() => void>>;
  let board: HTMLElement;

  beforeEach(() => {
    onCycleCell =
      vi.fn<(cellIndex: number, direction: TakuzuCycleDirection) => void>();
    onPlaceCell = vi.fn<(cellIndex: number, cell: TakuzuCell) => void>();
    onClearingComplete = vi.fn<() => void>();
  });

  describe("操作できる場合", () => {
    beforeEach(() => {
      render(
        <TakuzuBoard
          size={2}
          cells={cells}
          disabled={false}
          clearing={false}
          onCycleCell={onCycleCell}
          onPlaceCell={onPlaceCell}
          onClearingComplete={onClearingComplete}
        />,
      );
      board = screen.getByRole("group", { name: "盤面" });
    });

    test("マスの位置・中身・固定・ルール違反を名前で伝えること", () => {
      const result = within(board)
        .getAllByRole("button")
        .map((cell) => cell.getAttribute("aria-label"));

      expect(result).toEqual([
        "1行1列 A 固定",
        "1行2列 空き",
        "2行1列 B ルール違反",
        "2行2列 空き",
      ]);
    });

    test("Tab で入る先を左上のマスひとつにすること", () => {
      const result = within(board)
        .getAllByRole("button")
        .map((cell) => cell.tabIndex);

      expect(result).toEqual([0, -1, -1, -1]);
    });

    test("タップで順方向の巡回を通知すること", () => {
      fireEvent.click(
        within(board).getByRole("button", { name: "1行2列 空き" }),
      );

      expect(onCycleCell).toHaveBeenCalledWith(1, "forward");
    });

    test("右クリックで逆方向の巡回を通知すること", () => {
      fireEvent.contextMenu(
        within(board).getByRole("button", { name: "2行1列 B ルール違反" }),
      );

      expect(onCycleCell).toHaveBeenCalledWith(2, "backward");
    });

    test("タッチの長押しでは逆方向の巡回を通知しないこと", () => {
      const cell = within(board).getByRole("button", {
        name: "2行1列 B ルール違反",
      });

      fireEvent.pointerDown(cell, { pointerType: "touch" });
      fireEvent.contextMenu(cell);

      expect(onCycleCell).not.toHaveBeenCalled();
    });

    test("固定マスを押しても通知しないこと", () => {
      const givenCell = within(board).getByRole("button", {
        name: "1行1列 A 固定",
      });

      fireEvent.click(givenCell);
      fireEvent.contextMenu(givenCell);

      expect(onCycleCell).not.toHaveBeenCalled();
    });

    describe("左上のマスにフォーカスがある場合", () => {
      beforeEach(() => {
        within(board).getByRole("button", { name: "1行1列 A 固定" }).focus();
      });

      const arrowKeyCases = [
        ["ArrowRight", "1行2列 空き"],
        ["ArrowDown", "2行1列 B ルール違反"],
        ["ArrowLeft", "1行1列 A 固定"],
        ["ArrowUp", "1行1列 A 固定"],
      ] as const;

      test.each(arrowKeyCases)(
        "%s キーで %s のマスへフォーカスを移すこと",
        (key, expectedName) => {
          fireEvent.keyDown(document.activeElement ?? board, { key });
          const result = document.activeElement?.getAttribute("aria-label");

          expect(result).toBe(expectedName);
        },
      );

      test("固定マスへのキー入力を通知しないこと", () => {
        fireEvent.keyDown(document.activeElement ?? board, { key: "2" });

        expect(onPlaceCell).not.toHaveBeenCalled();
      });
    });

    describe("空きマスにフォーカスがある場合", () => {
      beforeEach(() => {
        within(board).getByRole("button", { name: "1行2列 空き" }).focus();
      });

      const inputKeyCases = [
        ["1", "a"],
        ["2", "b"],
        ["0", null],
        ["Backspace", null],
        ["Delete", null],
      ] as const;

      test.each(inputKeyCases)(
        "%s キーでそのマスへ %s を置くよう通知すること",
        (key, expectedCell) => {
          fireEvent.keyDown(document.activeElement ?? board, { key });

          expect(onPlaceCell).toHaveBeenCalledWith(1, expectedCell);
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

  describe("操作できない場合", () => {
    beforeEach(() => {
      render(
        <TakuzuBoard
          size={2}
          cells={cells}
          disabled={true}
          clearing={false}
          onCycleCell={onCycleCell}
          onPlaceCell={onPlaceCell}
          onClearingComplete={onClearingComplete}
        />,
      );
      board = screen.getByRole("group", { name: "盤面" });
    });

    test("空きマスを押しても通知しないこと", () => {
      fireEvent.click(
        within(board).getByRole("button", { name: "1行2列 空き" }),
      );
      fireEvent.contextMenu(
        within(board).getByRole("button", { name: "2行2列 空き" }),
      );

      expect(onCycleCell).not.toHaveBeenCalled();
    });

    test("キー入力を通知しないこと", () => {
      fireEvent.keyDown(
        within(board).getByRole("button", { name: "1行2列 空き" }),
        { key: "1" },
      );

      expect(onPlaceCell).not.toHaveBeenCalled();
    });
  });

  describe("完成演出を再生できない環境の場合", () => {
    let rerender: ReturnType<typeof render>["rerender"];

    beforeEach(() => {
      ({ rerender } = render(
        <TakuzuBoard
          size={2}
          cells={cells}
          disabled={true}
          clearing={false}
          onCycleCell={onCycleCell}
          onPlaceCell={onPlaceCell}
          onClearingComplete={onClearingComplete}
        />,
      ));
    });

    test("完成演出に入るとすぐに完成演出の完了を通知すること", () => {
      rerender(
        <TakuzuBoard
          size={2}
          cells={cells}
          disabled={true}
          clearing={true}
          onCycleCell={onCycleCell}
          onPlaceCell={onPlaceCell}
          onClearingComplete={onClearingComplete}
        />,
      );

      expect(onClearingComplete).toHaveBeenCalledOnce();
    });
  });
});
