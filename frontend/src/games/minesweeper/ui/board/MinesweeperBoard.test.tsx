import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import type { MinesweeperVisibleCell } from "@/games/minesweeper/session/session";
import { MinesweeperBoard } from "@/games/minesweeper/ui/board/MinesweeperBoard";

describe("MinesweeperBoard", () => {
  const cells: readonly MinesweeperVisibleCell[] = [
    { state: "hidden" },
    { state: "revealed", adjacentMineCount: 1 },
    { state: "hidden" },
    { state: "hidden" },
  ];
  let onRevealCell: (cellIndex: number) => void;
  let onToggleFlag: (cellIndex: number) => void;
  let onChordCell: (cellIndex: number) => void;

  beforeEach(() => {
    onRevealCell = vi.fn();
    onToggleFlag = vi.fn();
    onChordCell = vi.fn();
  });

  test("開示モードで未開示マスを押すと開示操作を通知すること", () => {
    render(
      <MinesweeperBoard
        rows={2}
        columns={2}
        cells={cells}
        mode="reveal"
        interactionDisabled={false}
        onRevealCell={onRevealCell}
        onToggleFlag={onToggleFlag}
        onChordCell={onChordCell}
      />,
    );

    fireEvent.click(screen.getByLabelText("マス 1 未開示"));

    expect(onRevealCell).toHaveBeenCalledWith(0);
  });

  test("旗モードで未開示マスを押すと旗操作を通知すること", () => {
    render(
      <MinesweeperBoard
        rows={2}
        columns={2}
        cells={cells}
        mode="flag"
        interactionDisabled={false}
        onRevealCell={onRevealCell}
        onToggleFlag={onToggleFlag}
        onChordCell={onChordCell}
      />,
    );

    fireEvent.click(screen.getByLabelText("マス 1 未開示"));

    expect(onToggleFlag).toHaveBeenCalledWith(0);
  });

  test("開示モードで開示済み数字を押すとchord操作を通知すること", () => {
    render(
      <MinesweeperBoard
        rows={2}
        columns={2}
        cells={cells}
        mode="reveal"
        interactionDisabled={false}
        onRevealCell={onRevealCell}
        onToggleFlag={onToggleFlag}
        onChordCell={onChordCell}
      />,
    );

    fireEvent.click(screen.getByLabelText("マス 2 開示済み 1"));

    expect(onChordCell).toHaveBeenCalledWith(1);
  });

  test("旗モードで開示済み数字を押しても盤面を開示しないこと", () => {
    render(
      <MinesweeperBoard
        rows={2}
        columns={2}
        cells={cells}
        mode="flag"
        interactionDisabled={false}
        onRevealCell={onRevealCell}
        onToggleFlag={onToggleFlag}
        onChordCell={onChordCell}
      />,
    );

    fireEvent.click(screen.getByLabelText("マス 2 開示済み 1"));

    expect(onChordCell).not.toHaveBeenCalled();
    expect(onRevealCell).not.toHaveBeenCalled();
    expect(onToggleFlag).not.toHaveBeenCalled();
  });

  test("盤面デザインを変更してもマスの操作とアクセシブルな状態を保つこと", () => {
    const common = {
      rows: 2,
      columns: 2,
      cells,
      mode: "reveal" as const,
      interactionDisabled: false,
      onRevealCell,
      onToggleFlag,
      onChordCell,
    };
    const { rerender } = render(
      <MinesweeperBoard {...common} visualStyle="relief" />,
    );
    const hiddenCell = screen.getByLabelText("マス 1 未開示");
    expect(hiddenCell.className).toContain("rounded-[3px]");

    rerender(<MinesweeperBoard {...common} visualStyle="ink" />);
    expect(screen.getByLabelText("マス 1 未開示")).toBe(hiddenCell);
    expect(hiddenCell.className).toContain("bg-[#335765]");
    fireEvent.click(hiddenCell);
    expect(onRevealCell).toHaveBeenCalledWith(0);
  });
});

describe("立体盤面の駒", () => {
  test("旗と地雷を専用の形で描き、従来の盤面では既存アイコンを保つこと", () => {
    const cells: readonly MinesweeperVisibleCell[] = [
      { state: "flagged" },
      { state: "mine" },
    ];
    const props = {
      rows: 1,
      columns: 2,
      cells,
      mode: "reveal" as const,
      interactionDisabled: false,
      onRevealCell: vi.fn(),
      onToggleFlag: vi.fn(),
      onChordCell: vi.fn(),
    };
    const { rerender } = render(
      <MinesweeperBoard {...props} visualStyle="relief" />,
    );
    expect(
      screen.getByLabelText("マス 1 旗").querySelector("svg path[d^='M10 5']"),
    ).not.toBeNull();
    expect(
      screen.getByLabelText("マス 2 地雷").querySelector("svg circle[cx='16']"),
    ).not.toBeNull();

    rerender(<MinesweeperBoard {...props} visualStyle="classic" />);
    expect(
      screen.getByLabelText("マス 1 旗").querySelector("svg path[d^='M10 5']"),
    ).toBeNull();
  });
});
