// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import type { MinesweeperVisibleCell } from "../../session/session";
import { MinesweeperBoard } from "./MinesweeperBoard";

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
        disabled={false}
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
        disabled={false}
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
        disabled={false}
        onRevealCell={onRevealCell}
        onToggleFlag={onToggleFlag}
        onChordCell={onChordCell}
      />,
    );

    fireEvent.click(screen.getByLabelText("マス 2 開示済み 1"));

    expect(onChordCell).toHaveBeenCalledWith(1);
  });
});
