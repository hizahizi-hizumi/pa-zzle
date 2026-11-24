import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { ReactNode } from "react";

import { parseMagicSquareBoard } from "@/games/magic-square/puzzle/board";
import { listMagicSquareLineEvaluations } from "@/games/magic-square/puzzle/rules";
import type { MagicSquareBoardRegion } from "@/games/magic-square/ui/board/board-layout";
import { MagicSquareBoard } from "@/games/magic-square/ui/board/MagicSquareBoard";

const givens = parseMagicSquareBoard([
  ". 4 5 .",
  ". 2 . .",
  ". . 12 1",
  "3 . 10 6",
]);
const board = parseMagicSquareBoard([
  "14 4 5 13",
  ". 2 . .",
  ". . 12 1",
  "3 . 10 6",
]);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("MagicSquareBoard", () => {
  let onSelectCell: ReturnType<typeof vi.fn<(cellIndex: number) => void>>;
  let onClearAnimationComplete: ReturnType<typeof vi.fn<() => void>>;

  function renderBoard(props: {
    clearing?: boolean;
    interactionDisabled?: boolean;
    memos?: readonly (readonly number[])[];
    region?: MagicSquareBoardRegion;
    renderCellOverlay?: (cellIndex: number) => ReactNode;
  }) {
    render(
      <MagicSquareBoard
        givens={givens}
        board={board}
        memos={props.memos}
        lineEvaluations={listMagicSquareLineEvaluations(board)}
        selectedCellIndex={0}
        interactionDisabled={props.interactionDisabled ?? false}
        clearing={props.clearing ?? false}
        region={props.region}
        renderCellOverlay={props.renderCellOverlay}
        onSelectCell={onSelectCell}
        onClearAnimationComplete={onClearAnimationComplete}
      />,
    );
  }

  beforeEach(() => {
    onSelectCell = vi.fn();
    onClearAnimationComplete = vi.fn();
  });

  describe("プレイ中の場合", () => {
    beforeEach(() => {
      renderBoard({});
    });

    test("そろえる合計を盤面のそばに出すこと", () => {
      const boardGroup = screen.getByRole("group", { name: "魔方陣の盤面" });

      const magicSum = within(boardGroup).getByText("そろえる合計 34");

      expect(magicSum).toBeTruthy();
    });

    test("列ごとに、今の合計と、そろった・違反の状態を読み上げに出すこと", () => {
      const boardGroup = screen.getByRole("group", { name: "魔方陣の盤面" });

      const sums = [
        "1行目の合計 36 埋まって合計が合わない",
        "1列目の合計 17",
        "右上からの斜めの合計 16",
        "左上からの斜めの合計 34 そろった",
      ].map((text) => within(boardGroup).queryByText(text));

      expect(sums.every((sum) => sum !== null)).toBe(true);
    });

    test("選んだマスを押された状態にすること", () => {
      const cell = screen.getByRole("button", { name: "1行1列 14" });

      expect(cell.getAttribute("aria-pressed")).toBe("true");
    });

    test("マスを押すとそのマスを選ぶ操作を知らせること", () => {
      fireEvent.click(screen.getByRole("button", { name: "2行1列 空き" }));

      expect(onSelectCell).toHaveBeenCalledWith(4);
    });
  });

  describe("メモを書いたマスがある場合", () => {
    beforeEach(() => {
      renderBoard({
        memos: board.cells.map((_, cellIndex) =>
          cellIndex === 4 ? [9, 11] : cellIndex === 0 ? [7] : [],
        ),
      });
    });

    test("空きマスにメモの数を小さく書き、数を置いたマスに残したメモは書かないこと", () => {
      const cells = [
        screen.getByRole("button", { name: "2行1列 空き メモ 9 11" }),
        screen.getByRole("button", { name: "1行1列 14" }),
      ];

      expect(cells.map((cell) => cell.textContent)).toEqual(["911", "14"]);
    });
  });

  /** 盤面に描いたマスの読み上げ名と、列の端の合計の読み上げ。 */
  function readDrawn(): { cells: string[]; sums: string[] } {
    const boardGroup = screen.getByRole("group", { name: "魔方陣の盤面" });
    return {
      cells: within(boardGroup)
        .getAllByRole("button")
        .map((cell) => cell.getAttribute("aria-label") ?? ""),
      sums: [...boardGroup.querySelectorAll(".sr-only")].map(
        (label) => label.textContent ?? "",
      ),
    };
  }

  describe("左端を含む1行だけの範囲を渡した場合", () => {
    beforeEach(() => {
      renderBoard({
        region: { row: 0, column: 0, rowCount: 1, columnCount: 4 },
      });
    });

    test("範囲のマスと、その行の合計と、そろえる合計だけを描くこと", () => {
      expect(readDrawn()).toEqual({
        cells: ["1行1列 14", "1行2列 4", "1行3列 5", "1行4列 13"],
        sums: ["そろえる合計 34", "1行目の合計 36 埋まって合計が合わない"],
      });
    });
  });

  describe("左端を含まない1マスだけの範囲を渡した場合", () => {
    beforeEach(() => {
      renderBoard({
        region: { row: 2, column: 3, rowCount: 1, columnCount: 1 },
      });
    });

    test("そろえる合計を描かず、そのマスとその行の合計だけを描くこと", () => {
      expect(readDrawn()).toEqual({
        cells: ["3行4列 1"],
        sums: ["3行目の合計 13"],
      });
    });
  });

  describe("下端の行の1マスだけの範囲を渡した場合", () => {
    beforeEach(() => {
      renderBoard({
        region: { row: 3, column: 1, rowCount: 1, columnCount: 1 },
      });
    });

    test("そのマスと、その下の縦の列の合計だけを描くこと", () => {
      expect(readDrawn()).toEqual({
        cells: ["4行2列 空き"],
        sums: ["2列目の合計 6"],
      });
    });
  });

  describe("右下の角のマスだけの範囲を渡した場合", () => {
    beforeEach(() => {
      renderBoard({
        region: { row: 3, column: 3, rowCount: 1, columnCount: 1 },
      });
    });

    test("そのマスの行と縦の列の合計と、角に置く左上からの斜めの合計を描くこと", () => {
      expect(readDrawn().sums.sort()).toEqual(
        [
          "4行目の合計 19",
          "4列目の合計 20",
          "左上からの斜めの合計 34 そろった",
        ].sort(),
      );
    });
  });

  describe("マスに重ねる物を渡した場合", () => {
    beforeEach(() => {
      renderBoard({
        renderCellOverlay: (cellIndex) =>
          cellIndex === 5 ? <span data-testid="overlay" /> : null,
      });
    });

    test("そのマスのボタンの中に重ねること", () => {
      const overlay = screen.getByTestId("overlay");

      expect(overlay.closest("button")?.getAttribute("aria-label")).toBe(
        "2行2列 2",
      );
    });
  });

  describe("操作を受け付けない場合", () => {
    beforeEach(() => {
      renderBoard({ interactionDisabled: true });
    });

    test("マスを押しても選ぶ操作を知らせないこと", () => {
      fireEvent.click(screen.getByRole("button", { name: "2行1列 空き" }));

      expect(onSelectCell).not.toHaveBeenCalled();
    });
  });

  describe("完成演出の場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      renderBoard({ clearing: true, interactionDisabled: true });
    });

    test("動かせない環境でも、そろった盤面を見せてから演出の完了を知らせること", () => {
      act(() => vi.advanceTimersByTime(1_000));

      expect(onClearAnimationComplete).toHaveBeenCalledTimes(1);
    });
  });
});
