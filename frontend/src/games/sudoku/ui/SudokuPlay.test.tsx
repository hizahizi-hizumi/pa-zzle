import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { SudokuPlay } from "./SudokuPlay";

afterEach(cleanup);

function emptyBoard() {
  return Array.from({ length: 81 }, () => null);
}

function emptyNotes() {
  return Array.from({ length: 81 }, () => []);
}

function createProps(): ComponentProps<typeof SudokuPlay> {
  return {
    difficulty: "normal",
    status: "playing",
    progress: "playing",
    clues: emptyBoard(),
    board: emptyBoard(),
    notes: emptyNotes(),
    selectedCellIndex: 0,
    conflictCellIndices: [],
    mistakeCellIndices: [],
    notesMode: false,
    elapsedMs: 65_000,
    mistakeCount: 2,
    undoCount: 1,
    restartCount: 0,
    canUndo: true,
    result: null,
    selectCell: vi.fn(),
    inputDigit: vi.fn(),
    erase: vi.fn(),
    toggleNotesMode: vi.fn(),
    undo: vi.fn(),
    restart: vi.fn(),
    replay: vi.fn(),
    newGame: vi.fn(),
    onChangeDifficulty: vi.fn(),
    onBackToHome: vi.fn(),
    completeClearPresentation: vi.fn(),
  };
}

describe("SudokuPlay", () => {
  test("選択した空きマスへ数字入力を通知すること", () => {
    const props = createProps();
    render(<SudokuPlay {...props} />);
    const digit = screen.getByRole("button", { name: "5" });

    fireEvent.click(digit);

    expect(props.inputDigit).toHaveBeenCalledWith(5);
  });

  test("初期ヒントを選択している間は数字入力を無効にすること", () => {
    const props = createProps();
    const clues = [...props.clues];
    const board = [...props.board];
    clues[0] = 5;
    board[0] = 5;
    render(<SudokuPlay {...props} clues={clues} board={board} />);
    const digit = screen.getByRole("button", { name: "5" });

    const disabled = digit.hasAttribute("disabled");

    expect(disabled).toBe(true);
  });

  test("手動メモモードと待ったを通知すること", () => {
    const props = createProps();
    render(<SudokuPlay {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "メモ" }));
    fireEvent.click(screen.getByRole("button", { name: "待った" }));

    expect(props.toggleNotesMode).toHaveBeenCalledOnce();
    expect(props.undo).toHaveBeenCalledOnce();
  });

  test("ミスと待ったを別のプレイ状況として表示すること", () => {
    const props = createProps();
    render(<SudokuPlay {...props} />);

    expect(screen.getByText("ミス")).toBeTruthy();
    expect(screen.getAllByText("待った")).toHaveLength(2);
    expect(screen.getByText("ナンプレ")).toBeTruthy();
  });

  test("9個使われた数字の入力を無効にすること", () => {
    const props = createProps();
    const board = [...props.board];
    for (let index = 0; index < 9; index += 1) {
      board[index] = 9;
    }
    render(<SudokuPlay {...props} board={board} selectedCellIndex={9} />);
    const digit = screen.getByRole("button", { name: "9" });

    const disabled = digit.hasAttribute("disabled");

    expect(disabled).toBe(true);
  });

  test("誤答を含む9個だけでは数字入力を使い切り扱いにしないこと", () => {
    const props = createProps();
    const board = [...props.board];
    for (let index = 0; index < 9; index += 1) {
      board[index] = 9;
    }
    render(
      <SudokuPlay
        {...props}
        board={board}
        selectedCellIndex={9}
        mistakeCellIndices={[0]}
      />,
    );
    const digit = screen.getByRole("button", { name: "9" });

    const disabled = digit.hasAttribute("disabled");

    expect(disabled).toBe(false);
  });

  test("手動メモだけの選択マスでも消す操作を有効にすること", () => {
    const props = createProps();
    const notes = [...props.notes];
    notes[0] = [4];
    render(<SudokuPlay {...props} notes={notes} />);
    const erase = screen.getByRole("button", { name: "消す" });

    const disabled = erase.hasAttribute("disabled");

    expect(disabled).toBe(false);
  });

  test("その他の操作から同じ問題のやり直しを通知すること", () => {
    const props = createProps();
    render(<SudokuPlay {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "その他の操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "最初から" }));

    expect(props.restart).toHaveBeenCalledOnce();
  });

  test("クリア直後は完成盤を見せて結果画面への遷移を待つこと", () => {
    const props = createProps();
    const result = {
      elapsedMs: 125_000,
      mistakeCount: 0,
      undoCount: 0,
      restartCount: 0,
      problemIdentity: {
        generatorVersion: "1" as const,
        seed: "test-seed",
        conditions: { clueCount: 32 },
        generationAttempt: 1,
      },
    };
    render(
      <SudokuPlay
        {...props}
        status="cleared"
        progress="clearing"
        result={result}
      />,
    );

    expect(screen.queryByRole("heading", { name: "クリア" })).toBeNull();
    expect(screen.getAllByRole("button", { name: /行.*列/ })).toHaveLength(81);
    expect(
      screen.getByRole("button", { name: "消す" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "1" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  test("クリア後に成績生データと次の操作を表示すること", () => {
    const props = createProps();
    const newGame = vi.fn();
    render(
      <SudokuPlay
        {...props}
        status="cleared"
        progress="result"
        result={{
          elapsedMs: 125_000,
          mistakeCount: 2,
          undoCount: 3,
          restartCount: 1,
          problemIdentity: {
            generatorVersion: "1",
            seed: "test-seed",
            conditions: { clueCount: 32 },
            generationAttempt: 1,
          },
        }}
        newGame={newGame}
      />,
    );

    const heading = screen.getByRole("heading", { name: "クリア" });
    fireEvent.click(screen.getByRole("button", { name: "新しい問題" }));

    expect(heading).toBeTruthy();
    expect(screen.getByText("02:05")).toBeTruthy();
    expect(newGame).toHaveBeenCalledOnce();
  });
});
