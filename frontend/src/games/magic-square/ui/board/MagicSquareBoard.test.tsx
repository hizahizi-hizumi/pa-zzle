import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { parseMagicSquareBoard } from "@/games/magic-square/puzzle/board";
import { listMagicSquareLineEvaluations } from "@/games/magic-square/puzzle/rules";
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
  }) {
    render(
      <MagicSquareBoard
        givens={givens}
        board={board}
        lineEvaluations={listMagicSquareLineEvaluations(board)}
        selectedCellIndex={0}
        interactionDisabled={props.interactionDisabled ?? false}
        clearing={props.clearing ?? false}
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

      expect(
        within(boardGroup).getByText("合計").nextSibling?.textContent,
      ).toBe("34");
    });

    test("列ごとに今の合計と状態を出すこと", () => {
      const sums = [
        screen.getByLabelText("1行目の合計 36"),
        screen.getByLabelText("1列目の合計 17"),
        screen.getByLabelText("右上からの斜めの合計 16"),
      ];

      expect(sums.map((sum) => sum.getAttribute("data-line-status"))).toEqual([
        "unmatched",
        "incomplete",
        "incomplete",
      ]);
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
