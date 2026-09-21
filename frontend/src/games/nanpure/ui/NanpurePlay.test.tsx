import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";

import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";

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
    recordOutcomeNotice: null,
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

describe("空きマスを選択している場合", () => {
  let props: ComponentProps<typeof NanpurePlay>;
  let digit: HTMLElement;

  beforeEach(() => {
    props = createProps();
    render(<NanpurePlay {...props} />);
    const digitInput = screen.getByRole("group", { name: "数字入力" });
    digit = within(digitInput).getByText("5");
  });

  test("数字入力を通知すること", () => {
    fireEvent.click(digit);

    expect(props.onInputDigit).toHaveBeenCalledWith(5);
  });
});

describe("初期ヒントを選択している場合", () => {
  let digit: HTMLElement;

  beforeEach(() => {
    const props = createProps();
    const clues = [...props.clues];
    const board = [...props.board];
    clues[0] = 5;
    board[0] = 5;
    render(<NanpurePlay {...props} clues={clues} board={board} />);
    const digitInput = screen.getByRole("group", { name: "数字入力" });
    digit = within(digitInput).getByText("5");
  });

  test("数字入力を無効にすること", () => {
    const disabled = digit.hasAttribute("disabled");

    expect(disabled).toBe(true);
  });
});

describe("プレイ中の場合", () => {
  let props: ComponentProps<typeof NanpurePlay>;

  beforeEach(() => {
    props = createProps();
    render(<NanpurePlay {...props} />);
  });

  test("手動メモモードと待ったを通知すること", () => {
    fireEvent.click(screen.getByRole("button", { name: "メモ" }));
    fireEvent.click(screen.getByRole("button", { name: "待った" }));

    expect(props.onToggleNotesMode).toHaveBeenCalledOnce();
    expect(props.onUndo).toHaveBeenCalledOnce();
  });

  test("ミスと待ったを別のプレイ状況として表示すること", () => {
    const mistakeLabel = screen.getByText("ミス");
    const undoLabels = screen.getAllByText("待った");
    const gameName = screen.getByText("ナンプレ");

    expect(mistakeLabel).toBeTruthy();
    expect(undoLabels).toHaveLength(2);
    expect(gameName).toBeTruthy();
  });

  test("その他の操作から盤面を戻すとリセットを通知すること", () => {
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "その他の操作" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "盤面を戻す" }));
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "その他の操作" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "リセット" }));

    expect(props.onRestart).toHaveBeenCalledOnce();
    expect(props.onReplay).toHaveBeenCalledOnce();
  });
});

describe("数字9を使い切っている場合", () => {
  let digit: HTMLElement;

  beforeEach(() => {
    const props = createProps();
    render(<NanpurePlay {...props} completedDigits={[9]} />);
    const digitInput = screen.getByRole("group", { name: "数字入力" });
    digit = within(digitInput).getByText("9");
  });

  test("数字9の入力を無効にすること", () => {
    const disabled = digit.hasAttribute("disabled");

    expect(disabled).toBe(true);
  });
});

describe("数字9を使い切っていない場合", () => {
  let digit: HTMLElement;

  beforeEach(() => {
    const props = createProps();
    render(<NanpurePlay {...props} completedDigits={[]} />);
    const digitInput = screen.getByRole("group", { name: "数字入力" });
    digit = within(digitInput).getByText("9");
  });

  test("数字9の入力を有効にすること", () => {
    const disabled = digit.hasAttribute("disabled");

    expect(disabled).toBe(false);
  });
});

describe("手動メモだけがあるマスを選択している場合", () => {
  let erase: HTMLElement;

  beforeEach(() => {
    const props = createProps();
    const notes = [...props.notes];
    notes[0] = [4];
    render(<NanpurePlay {...props} notes={notes} />);
    erase = screen.getByRole("button", { name: "消す" });
  });

  test("消す操作を有効にすること", () => {
    const disabled = erase.hasAttribute("disabled");

    expect(disabled).toBe(false);
  });
});

describe("クリア演出中の場合", () => {
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
  let board: HTMLElement;
  let digitInput: HTMLElement;

  beforeEach(() => {
    const props = createProps();
    render(
      <NanpurePlay
        {...props}
        status="cleared"
        progress="clearing"
        result={result}
      />,
    );
    board = screen.getByRole("main");
    digitInput = screen.getByRole("group", { name: "数字入力" });
  });

  test("完成盤を見せて結果画面への遷移を待つこと", () => {
    const resultHeading = screen.queryByRole("heading", { name: "クリア" });
    const cells = within(board).getAllByRole("button", { name: /行.*列/ });
    const erase = screen.getByRole("button", { name: "消す" });
    const firstDigit = within(digitInput).getByText("1");

    expect(resultHeading).toBeNull();
    expect(cells).toHaveLength(81);
    expect(erase.hasAttribute("disabled")).toBe(true);
    expect(firstDigit.hasAttribute("disabled")).toBe(true);
  });
});

describe("採点結果を表示している場合", () => {
  let onStartNewProblem: () => void;

  beforeEach(() => {
    const props = createProps();
    onStartNewProblem = vi.fn();
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
  });

  test("共通の結果階層で採点結果を表示すること", () => {
    const heading = screen.getByRole("heading", { name: "プレイ結果" });
    const pictogram = document.querySelector('svg[aria-label="ナンプレ"]');
    const elapsedTime = screen.getByText("02:05");
    const score = screen.getByText("79");
    const playButton = screen.getByRole("button", { name: "プレイ！" });
    const replayButton = screen.getByRole("button", { name: "同じ問題" });

    expect(heading).toBeTruthy();
    expect(pictogram).toBeTruthy();
    expect(elapsedTime).toBeTruthy();
    expect(score).toBeTruthy();
    expect(playButton).toBeTruthy();
    expect(replayButton).toBeTruthy();

    fireEvent.click(screen.getByText("スコアの内訳・採点基準"));

    expect(screen.getByText("30 / 40")).toBeTruthy();
    expect(screen.getByText("9 / 20")).toBeTruthy();
    expect(screen.getByText(/ミス1回につき/)).toBeTruthy();
    expect(screen.getByText(/1分単位で切り上げ/)).toBeTruthy();
    expect(screen.getByText(/待った1回につき/)).toBeTruthy();

    fireEvent.click(playButton);

    expect(onStartNewProblem).toHaveBeenCalledOnce();
  });
});

describe("自己ベスト更新がある場合", () => {
  let onOpenRecords: () => void;

  beforeEach(() => {
    const props = createProps();
    onOpenRecords = vi.fn();
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
        recordOutcomeNotice={
          <PlayRecordOutcomeNotice
            outcome={{
              status: "updated",
              updates: [
                {
                  metricId: "elapsed-ms",
                  previousValue: 150_000,
                  currentValue: 120_000,
                },
              ],
            }}
            display={nanpurePlayRecordDisplay}
          />
        }
        onOpenRecords={onOpenRecords}
      />,
    );
  });

  test("更新内容と記録画面への導線を表示すること", () => {
    fireEvent.click(screen.getByRole("button", { name: "記録を確認" }));
    const bestUpdate = screen.getByRole("region", { name: "自己ベスト更新" });

    expect(bestUpdate.textContent).toContain("クリア時間");
    expect(bestUpdate.textContent).toContain("02:30");
    expect(bestUpdate.textContent).toContain("02:00");
    expect(onOpenRecords).toHaveBeenCalledOnce();
  });
});

describe("診断導線が許可されたプレイ中の場合", () => {
  let onOpenDiagnostics: () => void;

  beforeEach(() => {
    onOpenDiagnostics = vi.fn();
    render(
      <NanpurePlay {...createProps()} onOpenDiagnostics={onOpenDiagnostics} />,
    );
  });

  test("その他の操作から検証情報を開けること", () => {
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "その他の操作" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

    expect(onOpenDiagnostics).toHaveBeenCalledOnce();
  });
});

describe("診断導線が許可されていないプレイ中の場合", () => {
  beforeEach(() => {
    render(<NanpurePlay {...createProps()} />);
  });

  test("その他の操作へ検証情報を表示しないこと", () => {
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "その他の操作" }),
      { button: 0, ctrlKey: false },
    );

    expect(screen.queryByRole("menuitem", { name: "検証情報" })).toBeNull();
  });
});

describe("診断導線が許可された結果表示の場合", () => {
  let onOpenDiagnostics: () => void;

  beforeEach(() => {
    onOpenDiagnostics = vi.fn();
    render(
      <NanpurePlay
        {...createProps()}
        status="cleared"
        progress="result"
        result={{
          elapsedMs: 125_000,
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
        onOpenDiagnostics={onOpenDiagnostics}
      />,
    );
  });

  test("結果画面から検証情報を開けること", () => {
    fireEvent.click(screen.getByRole("button", { name: "検証情報" }));

    expect(onOpenDiagnostics).toHaveBeenCalledOnce();
  });
});
