import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { NanpureBoard as NanpureBoardState } from "@/games/nanpure/puzzle/board";
import type { NanpureNotes } from "@/games/nanpure/session/session";

import { NanpureBoard } from "./NanpureBoard";

afterEach(cleanup);

function emptyBoard(): NanpureBoardState {
  return Array.from({ length: 81 }, () => null);
}

function emptyNotes(): NanpureNotes {
  return Array.from({ length: 81 }, () => []);
}

describe("NanpureBoard", () => {
  test("初期ヒントとプレイヤー入力と手動メモを盤面へ表示すること", () => {
    const clues = [...emptyBoard()];
    clues[0] = 5;
    const board = [...clues];
    board[1] = 3;
    const notes = [...emptyNotes()];
    notes[2] = [1, 4];

    render(
      <NanpureBoard
        board={board}
        clues={clues}
        notes={notes}
        selectedCellIndex={null}
        conflictCellIndices={[]}
        mistakeCellIndices={[]}
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
      <NanpureBoard
        board={emptyBoard()}
        clues={emptyBoard()}
        notes={emptyNotes()}
        selectedCellIndex={null}
        conflictCellIndices={[]}
        mistakeCellIndices={[]}
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
      <NanpureBoard
        board={board}
        clues={emptyBoard()}
        notes={emptyNotes()}
        selectedCellIndex={null}
        conflictCellIndices={[0, 1]}
        mistakeCellIndices={[]}
        onSelectCell={vi.fn()}
      />,
    );
    const conflict = screen.getByRole("button", { name: "1行1列、5、競合" });

    const invalid = conflict.getAttribute("aria-invalid");

    expect(invalid).toBe("true");
  });

  test("競合しない誤答も利用者から識別できる状態にすること", () => {
    const board = [...emptyBoard()];
    board[0] = 3;
    render(
      <NanpureBoard
        board={board}
        clues={emptyBoard()}
        notes={emptyNotes()}
        selectedCellIndex={null}
        conflictCellIndices={[]}
        mistakeCellIndices={[0]}
        onSelectCell={vi.fn()}
      />,
    );
    const mistake = screen.getByRole("button", { name: "1行1列、3、誤り" });

    const invalid = mistake.getAttribute("aria-invalid");

    expect(invalid).toBe("true");
  });
});
