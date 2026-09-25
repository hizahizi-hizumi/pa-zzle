import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

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
  let board: HTMLElement;

  describe("操作できる場合", () => {
    beforeEach(() => {
      onCycleCell =
        vi.fn<(cellIndex: number, direction: TakuzuCycleDirection) => void>();
      render(
        <TakuzuBoard
          size={2}
          cells={cells}
          disabled={false}
          onCycleCell={onCycleCell}
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

    test("固定マスを押しても通知しないこと", () => {
      fireEvent.click(
        within(board).getByRole("button", { name: "1行1列 A 固定" }),
      );

      expect(onCycleCell).not.toHaveBeenCalled();
    });
  });

  describe("操作できない場合", () => {
    beforeEach(() => {
      onCycleCell =
        vi.fn<(cellIndex: number, direction: TakuzuCycleDirection) => void>();
      render(
        <TakuzuBoard
          size={2}
          cells={cells}
          disabled={true}
          onCycleCell={onCycleCell}
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
  });
});
