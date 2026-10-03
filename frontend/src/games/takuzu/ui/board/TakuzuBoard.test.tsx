import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

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
          rowCount={2}
          columnCount={2}
          cells={cells}
          lineViolations={lineViolations}
          disabled={false}
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
        "1行1列 四角 固定",
        "1行2列 空き 列の個数超過",
        "2行1列 丸 3連続",
        "2行2列 空き 列の個数超過",
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
        within(board).getByRole("button", { name: "1行2列 空き 列の個数超過" }),
      );

      expect(onCycleCell).toHaveBeenCalledWith(1, "forward");
    });

    test("右クリックで逆方向の巡回を通知すること", () => {
      fireEvent.contextMenu(
        within(board).getByRole("button", { name: "2行1列 丸 3連続" }),
      );

      expect(onCycleCell).toHaveBeenCalledWith(2, "backward");
    });

    test("タッチの長押しでは逆方向の巡回を通知しないこと", () => {
      const cell = within(board).getByRole("button", {
        name: "2行1列 丸 3連続",
      });

      fireEvent.pointerDown(cell, { pointerType: "touch" });
      fireEvent.contextMenu(cell);

      expect(onCycleCell).not.toHaveBeenCalled();
    });

    test("固定マスを押しても通知しないこと", () => {
      const givenCell = within(board).getByRole("button", {
        name: "1行1列 四角 固定",
      });

      fireEvent.click(givenCell);
      fireEvent.contextMenu(givenCell);

      expect(onCycleCell).not.toHaveBeenCalled();
    });

    describe("左上のマスにフォーカスがある場合", () => {
      beforeEach(() => {
        within(board).getByRole("button", { name: "1行1列 四角 固定" }).focus();
      });

      const arrowKeyCases = [
        ["ArrowRight", "1行2列 空き 列の個数超過"],
        ["ArrowDown", "2行1列 丸 3連続"],
        ["ArrowLeft", "1行1列 四角 固定"],
        ["ArrowUp", "1行1列 四角 固定"],
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
        within(board)
          .getByRole("button", { name: "1行2列 空き 列の個数超過" })
          .focus();
      });

      const tileKeyCases = [
        ["1", "a"],
        ["2", "b"],
      ] as const;

      test.each(tileKeyCases)(
        "%s キーでそのマスへ %s を置くよう通知すること",
        (key, expectedCell) => {
          fireEvent.keyDown(document.activeElement ?? board, { key });

          expect(onPlaceCell).toHaveBeenCalledWith(1, expectedCell);
        },
      );

      const clearKeys = ["0", "Backspace", "Delete"];

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

  describe("操作する対象のマスを示す場合", () => {
    let onPressGivenCell: ReturnType<typeof vi.fn<(cellIndex: number) => void>>;

    beforeEach(() => {
      onPressGivenCell = vi.fn<(cellIndex: number) => void>();
      render(
        <TakuzuBoard
          rowCount={2}
          columnCount={2}
          cells={cells}
          lineViolations={[]}
          disabled={false}
          highlightedCellIndices={[1]}
          onCycleCell={onCycleCell}
          onPlaceCell={onPlaceCell}
          onPressGivenCell={onPressGivenCell}
        />,
      );
      board = screen.getByRole("group", { name: "バイナリパズル盤面" });
    });

    test("示したマスだけを操作対象として名前で伝えること", () => {
      const result = within(board)
        .getAllByRole("button")
        .map((cell) => cell.getAttribute("aria-label"));

      expect(result).toEqual([
        "1行1列 四角 固定",
        "1行2列 空き 操作対象",
        "2行1列 丸 3連続",
        "2行2列 空き",
      ]);
    });

    test("固定マスを押したことを通知すること", () => {
      fireEvent.click(
        within(board).getByRole("button", { name: "1行1列 四角 固定" }),
      );

      expect(onPressGivenCell).toHaveBeenCalledWith(0);
    });
  });

  describe("1行だけの盤面の場合", () => {
    const singleRowCells: TakuzuCellView[] = [
      { cell: "a", given: true, inViolatingRun: false },
      { cell: "b", given: true, inViolatingRun: false },
      { cell: "a", given: true, inViolatingRun: false },
      { cell: "a", given: false, inViolatingRun: false },
    ];
    const singleRowViolations: TakuzuLineViolationView[] = [
      { axis: "row", index: 0, overfilled: true, duplicated: false },
    ];

    beforeEach(() => {
      render(
        <TakuzuBoard
          rowCount={1}
          columnCount={4}
          cells={singleRowCells}
          lineViolations={singleRowViolations}
          disabled={false}
          onCycleCell={onCycleCell}
          onPlaceCell={onPlaceCell}
        />,
      );
      board = screen.getByRole("group", { name: "バイナリパズル盤面" });
    });

    test("1行に並ぶマスと行の違反を名前で伝えること", () => {
      const result = within(board)
        .getAllByRole("button")
        .map((cell) => cell.getAttribute("aria-label"));

      expect(result).toEqual([
        "1行1列 四角 固定 行の個数超過",
        "1行2列 丸 固定 行の個数超過",
        "1行3列 四角 固定 行の個数超過",
        "1行4列 四角 行の個数超過",
      ]);
    });

    describe("右端のマスにフォーカスがある場合", () => {
      beforeEach(() => {
        within(board)
          .getByRole("button", { name: "1行4列 四角 行の個数超過" })
          .focus();
      });

      test("右や下へ動かしても行の中に留まること", () => {
        fireEvent.keyDown(document.activeElement ?? board, {
          key: "ArrowRight",
        });
        fireEvent.keyDown(document.activeElement ?? board, {
          key: "ArrowDown",
        });
        const result = document.activeElement?.getAttribute("aria-label");

        expect(result).toBe("1行4列 四角 行の個数超過");
      });
    });
  });

  describe("操作できない場合", () => {
    beforeEach(() => {
      render(
        <TakuzuBoard
          rowCount={2}
          columnCount={2}
          cells={cells}
          lineViolations={lineViolations}
          disabled={true}
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
