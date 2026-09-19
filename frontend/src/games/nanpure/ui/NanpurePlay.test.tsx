import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

import { NanpurePlay } from "./NanpurePlay";

afterEach(cleanup);

function emptyBoard() {
  return Array.from({ length: 81 }, () => null);
}

function emptyNotes() {
  return Array.from({ length: 81 }, () => []);
}

function createProps(): ComponentProps<typeof NanpurePlay> {
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
    completedDigits: [],
    notesMode: false,
    elapsedMs: 65_000,
    mistakeCount: 2,
    undoCount: 1,
    canUndo: true,
    result: null,
    recordOutcome: null,
    onSelectCell: vi.fn(),
    onInputDigit: vi.fn(),
    onErase: vi.fn(),
    onToggleNotesMode: vi.fn(),
    onUndo: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onStartNewProblem: vi.fn(),
    onOpenRecords: vi.fn(),
    onChangeDifficulty: vi.fn(),
    onBackToHome: vi.fn(),
    onClearAnimationComplete: vi.fn(),
  };
}

describe("NanpurePlay", () => {
  test("選択した空きマスへ数字入力を通知すること", () => {
    const props = createProps();
    render(<NanpurePlay {...props} />);
    const digit = screen.getByRole("button", { name: "5" });

    fireEvent.click(digit);

    expect(props.onInputDigit).toHaveBeenCalledWith(5);
  });

  test("初期ヒントを選択している間は数字入力を無効にすること", () => {
    const props = createProps();
    const clues = [...props.clues];
    const board = [...props.board];
    clues[0] = 5;
    board[0] = 5;
    render(<NanpurePlay {...props} clues={clues} board={board} />);
    const digit = screen.getByRole("button", { name: "5" });

    const disabled = digit.hasAttribute("disabled");

    expect(disabled).toBe(true);
  });

  test("手動メモモードと待ったを通知すること", () => {
    const props = createProps();
    render(<NanpurePlay {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "メモ" }));
    fireEvent.click(screen.getByRole("button", { name: "待った" }));

    expect(props.onToggleNotesMode).toHaveBeenCalledOnce();
    expect(props.onUndo).toHaveBeenCalledOnce();
  });

  test("ミスと待ったを別のプレイ状況として表示すること", () => {
    const props = createProps();
    render(<NanpurePlay {...props} />);

    expect(screen.getByText("ミス")).toBeTruthy();
    expect(screen.getAllByText("待った")).toHaveLength(2);
    expect(screen.getByText("ナンプレ")).toBeTruthy();
  });

  test("使い切った数字の入力を無効にすること", () => {
    const props = createProps();
    render(<NanpurePlay {...props} completedDigits={[9]} />);
    const digit = screen.getByRole("button", { name: "9" });

    const disabled = digit.hasAttribute("disabled");

    expect(disabled).toBe(true);
  });

  test("使い切っていない数字の入力を有効にすること", () => {
    const props = createProps();
    render(<NanpurePlay {...props} completedDigits={[]} />);
    const digit = screen.getByRole("button", { name: "9" });

    const disabled = digit.hasAttribute("disabled");

    expect(disabled).toBe(false);
  });

  test("手動メモだけの選択マスでも消す操作を有効にすること", () => {
    const props = createProps();
    const notes = [...props.notes];
    notes[0] = [4];
    render(<NanpurePlay {...props} notes={notes} />);
    const erase = screen.getByRole("button", { name: "消す" });

    const disabled = erase.hasAttribute("disabled");

    expect(disabled).toBe(false);
  });

  test("その他の操作から同じ問題のやり直しを通知すること", () => {
    const props = createProps();
    render(<NanpurePlay {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "その他の操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "最初から" }));

    expect(props.onRestart).toHaveBeenCalledOnce();
  });

  test("クリア直後は完成盤を見せて結果画面への遷移を待つこと", () => {
    const props = createProps();
    const result = {
      elapsedMs: 125_000,
      mistakeCount: 0,
      undoCount: 0,
      restartCount: 0,
      score: {
        total: 100,
        breakdown: { accuracy: 40, speed: 40, stability: 20 },
      },
      problemIdentity: {
        generatorVersion: "1" as const,
        seed: "test-seed",
        conditions: { clueCount: 32 },
        generationAttempt: 1,
      },
    };
    render(
      <NanpurePlay
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

  test("クリア後に共通の結果階層で採点結果を表示すること", () => {
    const props = createProps();
    const onStartNewProblem = vi.fn();
    render(
      <NanpurePlay
        {...props}
        status="cleared"
        progress="result"
        result={{
          elapsedMs: 125_000,
          mistakeCount: 2,
          undoCount: 3,
          restartCount: 1,
          score: {
            total: 79,
            breakdown: { accuracy: 30, speed: 40, stability: 9 },
          },
          problemIdentity: {
            generatorVersion: "1",
            seed: "test-seed",
            conditions: { clueCount: 32 },
            generationAttempt: 1,
          },
        }}
        onStartNewProblem={onStartNewProblem}
      />,
    );

    const heading = screen.getByRole("heading", { name: "プレイ結果" });
    const pictogram = document.querySelector('svg[aria-label="ナンプレ"]');

    expect(heading).toBeTruthy();
    expect(pictogram).toBeTruthy();
    expect(screen.getByText("02:05")).toBeTruthy();
    expect(screen.getByText("79")).toBeTruthy();
    expect(screen.getByRole("button", { name: "プレイ！" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "同じ問題" })).toBeTruthy();

    fireEvent.click(screen.getByText("スコアの内訳・採点基準"));

    expect(screen.getByText("30 / 40")).toBeTruthy();
    expect(screen.getByText("9 / 20")).toBeTruthy();
    expect(screen.getByText(/ミス1回につき/)).toBeTruthy();
    expect(screen.getByText(/1分単位で切り上げ/)).toBeTruthy();
    expect(screen.getByText(/待った1回につき/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "プレイ！" }));

    expect(onStartNewProblem).toHaveBeenCalledOnce();
  });

  test("自己ベスト更新内容と記録画面への導線を表示すること", () => {
    const props = createProps();
    const onOpenRecords = vi.fn();
    render(
      <NanpurePlay
        {...props}
        status="cleared"
        progress="result"
        result={{
          elapsedMs: 120_000,
          mistakeCount: 0,
          undoCount: 0,
          restartCount: 0,
          score: {
            total: 100,
            breakdown: { accuracy: 40, speed: 40, stability: 20 },
          },
          problemIdentity: {
            generatorVersion: "1",
            seed: "test-seed",
            conditions: { clueCount: 32 },
            generationAttempt: 1,
          },
        }}
        recordOutcome={{
          status: "updated",
          updates: [
            {
              metricId: "elapsed-ms",
              previousValue: 150_000,
              currentValue: 120_000,
            },
          ],
        }}
        onOpenRecords={onOpenRecords}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "記録を確認" }));

    const bestUpdate = screen.getByRole("region", { name: "自己ベスト更新" });

    expect(bestUpdate.textContent).toContain("最速");
    expect(bestUpdate.textContent).toContain("02:30");
    expect(bestUpdate.textContent).toContain("02:00");
    expect(onOpenRecords).toHaveBeenCalledOnce();
  });
});
