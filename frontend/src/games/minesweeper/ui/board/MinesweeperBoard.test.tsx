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

  test("盤面の立体表現を維持して未開示マスを操作できること", () => {
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
    const hiddenCell = screen.getByLabelText("マス 1 未開示");

    fireEvent.click(hiddenCell);

    expect(hiddenCell.className).toContain("rounded-[4px]");
    expect(onRevealCell).toHaveBeenCalledWith(0);
  });
});

describe("立体盤面の駒", () => {
  const cells: readonly MinesweeperVisibleCell[] = [
    { state: "flagged" },
    { state: "mine" },
  ];

  test("旗と地雷を専用の形で描き設置した旗を揺らさないこと", () => {
    render(
      <MinesweeperBoard
        rows={1}
        columns={2}
        cells={cells}
        mode="reveal"
        interactionDisabled={false}
        onRevealCell={vi.fn()}
        onToggleFlag={vi.fn()}
        onChordCell={vi.fn()}
      />,
    );
    const flagCell = screen.getByLabelText("マス 1 旗");
    const mineCell = screen.getByLabelText("マス 2 地雷");

    expect(flagCell.querySelector("svg path[d^='M10 5']")).not.toBeNull();
    expect(mineCell.querySelector("svg circle[cx='16']")).not.toBeNull();
    expect(flagCell.className).not.toContain("active:brightness");
  });
});
