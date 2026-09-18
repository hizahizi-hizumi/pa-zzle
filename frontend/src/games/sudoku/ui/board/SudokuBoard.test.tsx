import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { SudokuNotes } from "@/games/sudoku/game/session";
import type { SudokuBoard as SudokuBoardState } from "@/games/sudoku/game/state";

import { SudokuBoard } from "./SudokuBoard";

afterEach(cleanup);

function emptyBoard(): SudokuBoardState {
  return Array.from({ length: 81 }, () => null);
}

function emptyNotes(): SudokuNotes {
  return Array.from({ length: 81 }, () => []);
}

describe("SudokuBoard", () => {
  test("初期ヒントとプレイヤー入力と手動メモを盤面へ表示すること", () => {
    const clues = [...emptyBoard()];
    clues[0] = 5;
    const board = [...clues];
    board[1] = 3;
    const notes = [...emptyNotes()];
    notes[2] = [1, 4];

    render(
      <SudokuBoard
        board={board}
        clues={clues}
        notes={notes}
        selectedCellIndex={null}
        conflictCellIndices={[]}
        onSelectCell={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "1行1列、5、初期ヒント" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "1行2列、3" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "1行3列、空き、メモ 1、4" }),
    ).toBeTruthy();
  });

  test("マス選択をセル番号で通知すること", () => {
    const onSelectCell = vi.fn();
    render(
      <SudokuBoard
        board={emptyBoard()}
        clues={emptyBoard()}
        notes={emptyNotes()}
        selectedCellIndex={null}
        conflictCellIndices={[]}
        onSelectCell={onSelectCell}
      />,
    );
    const cell = screen.getByRole("button", { name: "1行2列、空き" });

    fireEvent.click(cell);

    expect(onSelectCell).toHaveBeenCalledWith(1);
  });

  test("競合するマスを利用者から識別できる状態にすること", () => {
    const board = [...emptyBoard()];
    board[0] = 5;
    board[1] = 5;
    render(
      <SudokuBoard
        board={board}
        clues={emptyBoard()}
        notes={emptyNotes()}
        selectedCellIndex={null}
        conflictCellIndices={[0, 1]}
        onSelectCell={vi.fn()}
      />,
    );
    const conflict = screen.getByRole("button", { name: "1行1列、5" });

    const invalid = conflict.getAttribute("aria-invalid");

    expect(invalid).toBe("true");
  });
});
