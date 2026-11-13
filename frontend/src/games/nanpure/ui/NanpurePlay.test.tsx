import {
  cleanup,
  fireEvent,
  render as renderWithoutRouter,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps, ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { NanpurePlay } from "@/games/nanpure/ui/NanpurePlay";
import { nanpurePlayRecordDisplay } from "@/games/nanpure/ui/play-record-display";
import { createResultRecordFeedback } from "@/records/ui/result-record-feedback";

/** 結果画面はブランドの帯からホームへ戻るリンクを持つので、ルーターの中で描く。 */
function render(ui: ReactElement) {
  return renderWithoutRouter(ui, { wrapper: MemoryRouter });
}

afterEach(cleanup);

function emptyBoard() {
  return Array.from({ length: 81 }, () => null);
}

function emptyNotes() {
  return Array.from({ length: 81 }, () => []);
}

function createProps(): ComponentProps<typeof NanpurePlay> {
  return {
    difficulty: "3",
    progress: "playing",
    clues: emptyBoard(),
    board: emptyBoard(),
    notes: emptyNotes(),
    selectedCellIndex: 0,
    conflictCellIndices: [],
    mistakeCellIndices: [],
    completedDigits: [],
    notesMode: false,
    lockedDigit: null,
    operation: null,
    elapsedMs: 65_000,
    mistakeCount: 2,
    undoCount: 1,
    canUndo: true,
    canRestart: true,
    result: null,
    recordFeedback: { kind: "none" } as const,
    onSelectCell: vi.fn(),
    onInputDigit: vi.fn(),
    onLockDigit: vi.fn(),
    onErase: vi.fn(),
    onToggleNotesMode: vi.fn(),
    onUndo: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onStartNewProblem: vi.fn(),
    onOpenGameHome: vi.fn(),
    onBackToAppHome: vi.fn(),
    onClearAnimationComplete: vi.fn(),
  };
}

describe("NanpurePlay", () => {
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
      const disabled = digit.getAttribute("aria-disabled");

      expect(disabled).toBe("true");
    });
  });

  describe("数字ボタンを長押しした場合", () => {
    let props: ComponentProps<typeof NanpurePlay>;
    let digit: HTMLElement;

    beforeEach(() => {
      vi.useFakeTimers();
      props = createProps();
      render(<NanpurePlay {...props} />);
      const digitInput = screen.getByRole("group", { name: "数字入力" });
      digit = within(digitInput).getByText("5");
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("その数字を固めることを通知し、離したときに数字を入れないこと", () => {
      fireEvent.pointerDown(digit, { button: 0 });
      vi.advanceTimersByTime(450);
      fireEvent.pointerUp(digit);
      fireEvent.click(digit, { detail: 1 });

      expect(props.onLockDigit).toHaveBeenCalledWith(5);
      expect(props.onInputDigit).not.toHaveBeenCalled();
    });

    test("ボタンの外で離した後のキーボードの押下で数字を入れること", () => {
      fireEvent.pointerDown(digit, { button: 0 });
      vi.advanceTimersByTime(450);
      fireEvent.pointerLeave(digit);
      fireEvent.click(digit, { detail: 0 });

      expect(props.onInputDigit).toHaveBeenCalledWith(5);
    });

    test("すぐに離すと固めずに数字を入れること", () => {
      fireEvent.pointerDown(digit, { button: 0 });
      vi.advanceTimersByTime(200);
      fireEvent.pointerUp(digit);
      fireEvent.click(digit);

      expect(props.onLockDigit).not.toHaveBeenCalled();
      expect(props.onInputDigit).toHaveBeenCalledWith(5);
    });
  });

  describe("数字を固めている場合", () => {
    let props: ComponentProps<typeof NanpurePlay>;
    let digitInput: HTMLElement;

    beforeEach(() => {
      props = createProps();
      render(
        <NanpurePlay {...props} selectedCellIndex={null} lockedDigit={7} />,
      );
      digitInput = screen.getByRole("group", { name: "数字入力" });
    });

    test("固めた数字のボタンを押された姿で示すこと", () => {
      const locked = within(digitInput).getByText("7");
      const other = within(digitInput).getByText("3");

      expect(locked.getAttribute("aria-pressed")).toBe("true");
      expect(other.getAttribute("aria-pressed")).toBe("false");
    });

    test("マスを選んでいなくても固めた数字を押せること", () => {
      fireEvent.click(within(digitInput).getByText("7"));

      expect(props.onInputDigit).toHaveBeenCalledWith(7);
    });
  });

  describe("プレイ中の場合", () => {
    let props: ComponentProps<typeof NanpurePlay>;

    beforeEach(() => {
      props = createProps();
      render(<NanpurePlay {...props} />);
    });

    test("手動メモモードと待ったを通知すること", () => {
      const inputPanel = screen.getByRole("contentinfo");
      fireEvent.click(within(inputPanel).getByRole("button", { name: "メモ" }));
      fireEvent.click(
        within(inputPanel).getByRole("button", { name: "待った" }),
      );

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

    test("遊び方を自動では開かないこと", () => {
      const dialog = screen.queryByRole("dialog", { name: "遊び方" });

      expect(dialog).toBeNull();
    });

    describe("その他の操作から遊び方を選んだ場合", () => {
      beforeEach(() => {
        fireEvent.pointerDown(
          screen.getByRole("button", { name: "その他の操作" }),
          { button: 0, ctrlKey: false },
        );
        fireEvent.click(screen.getByRole("menuitem", { name: "遊び方" }));
      });

      test("遊び方を開くこと", () => {
        const dialog = screen.getByRole("dialog", { name: "遊び方" });

        expect(dialog).toBeTruthy();
      });

      test("閉じてもプレイを測り直さないこと", () => {
        const dialog = screen.getByRole("dialog", { name: "遊び方" });
        fireEvent.click(within(dialog).getByRole("button", { name: "閉じる" }));

        expect(props.onReplay).not.toHaveBeenCalled();
      });
    });

    describe("その他の操作からチュートリアルを選んだ場合", () => {
      beforeEach(() => {
        fireEvent.pointerDown(
          screen.getByRole("button", { name: "その他の操作" }),
          { button: 0, ctrlKey: false },
        );
        fireEvent.click(
          screen.getByRole("menuitem", { name: "チュートリアル" }),
        );
      });

      test("チュートリアルを開くこと", () => {
        const dialog = screen.getByRole("dialog", {
          name: "ナンプレ",
          description: "チュートリアル",
        });

        expect(dialog).toBeTruthy();
      });

      test("閉じるとチュートリアルを閉じて同じプレイの盤面へ戻ること", () => {
        fireEvent.click(
          within(
            screen.getByRole("dialog", {
              name: "ナンプレ",
              description: "チュートリアル",
            }),
          ).getByRole("button", { name: "閉じる" }),
        );
        const dialog = screen.queryByRole("dialog", { name: "ナンプレ" });
        const cell = screen.getByRole("button", { name: "1行1列、空き" });

        expect(dialog).toBeNull();
        expect(cell).toBeTruthy();
        expect(props.onReplay).not.toHaveBeenCalled();
      });
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
      erase = within(screen.getByRole("contentinfo")).getByRole("button", {
        name: "消す",
      });
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
      speedRule: {
        fullScoreMs: 900_000,
        zeroScoreMs: 3_300_000,
        overtimeStepMs: 60_000,
      },
      timeDeltaMs: -775_000,
      score: {
        total: 100,
        breakdown: { accuracy: 40, speed: 40, stability: 20 },
      },
      problemIdentity: {
        generatorVersion: "2" as const,
        seed: "np-locked-candidates-740",
        conditions: { removalTechniqueLimit: "locked-candidates" as const },
      },
    };
    let board: HTMLElement;
    let inputPanel: HTMLElement;
    let digitInput: HTMLElement;

    beforeEach(() => {
      const props = createProps();
      render(<NanpurePlay {...props} progress="clearing" result={result} />);
      board = screen.getByRole("main");
      inputPanel = screen.getByRole("contentinfo");
      digitInput = within(inputPanel).getByRole("group", { name: "数字入力" });
    });

    test("完成盤を見せて結果画面への遷移を待つこと", () => {
      const resultHeading = screen.queryByRole("heading", { name: "クリア" });
      const cells = within(board).getAllByRole("button", { name: /行.*列/ });
      const erase = within(inputPanel).getByRole("button", { name: "消す" });
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
          progress="result"
          result={{
            elapsedMs: 125_000,
            mistakeCount: 2,
            undoCount: 3,
            restartCount: 1,
            speedRule: {
              fullScoreMs: 900_000,
              zeroScoreMs: 3_300_000,
              overtimeStepMs: 60_000,
            },
            timeDeltaMs: -775_000,
            score: {
              total: 79,
              breakdown: { accuracy: 30, speed: 40, stability: 9 },
            },
          }}
          onStartNewProblem={onStartNewProblem}
        />,
      );
    });

    test("共通の結果階層で採点結果を表示すること", () => {
      const heading = screen.getByRole("heading", { name: "プレイ結果" });

      const elapsedTime = screen.getByText("02:05");
      const score = screen.getByText("79点（100点満点）");
      const playButton = screen.getByRole("button", { name: "次の問題" });
      const replayButton = screen.getByRole("button", { name: "もう一度" });

      expect(heading).toBeTruthy();

      expect(elapsedTime).toBeTruthy();
      expect(score).toBeTruthy();
      expect(playButton).toBeTruthy();
      expect(replayButton).toBeTruthy();

      fireEvent.click(screen.getByText("採点内訳"));

      expect(screen.getByText("30 / 40")).toBeTruthy();
      expect(screen.getByText("9 / 20")).toBeTruthy();
      expect(screen.getByText(/ミス1回につき/)).toBeTruthy();
      expect(screen.getByText(/1分単位で切り上げ/)).toBeTruthy();
      expect(screen.getByText(/「待った」1回につき/)).toBeTruthy();

      fireEvent.click(playButton);

      expect(onStartNewProblem).toHaveBeenCalledOnce();
    });
  });

  describe("自己ベスト更新がある場合", () => {
    beforeEach(() => {
      const props = createProps();
      render(
        <NanpurePlay
          {...props}
          progress="result"
          result={{
            elapsedMs: 120_000,
            mistakeCount: 0,
            undoCount: 0,
            restartCount: 0,
            speedRule: {
              fullScoreMs: 900_000,
              zeroScoreMs: 3_300_000,
              overtimeStepMs: 60_000,
            },
            timeDeltaMs: -780_000,
            score: {
              total: 100,
              breakdown: { accuracy: 40, speed: 40, stability: 20 },
            },
          }}
          recordFeedback={createResultRecordFeedback(
            {
              status: "updated",
              updates: [
                {
                  metricId: "time-delta-ms",
                  previousValue: -750_000,
                  currentValue: -780_000,
                },
              ],
            },
            nanpurePlayRecordDisplay,
          )}
        />,
      );
    });

    test("更新内容を表示すること", () => {
      const bestUpdate =
        screen.getByLabelText(/基準時間との差の自己ベスト更新/);
      expect(bestUpdate).toBeTruthy();
      expect(bestUpdate.getAttribute("aria-label")).toContain(
        "-12:30から-13:00",
      );
      expect(bestUpdate.getAttribute("aria-label")).toContain("30秒短縮");
    });
  });

  describe("診断導線が許可されたプレイ中の場合", () => {
    let onOpenDiagnostics: () => void;

    beforeEach(() => {
      onOpenDiagnostics = vi.fn();
      render(
        <NanpurePlay
          {...createProps()}
          onOpenDiagnostics={onOpenDiagnostics}
        />,
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
          progress="result"
          result={{
            elapsedMs: 125_000,
            mistakeCount: 0,
            undoCount: 0,
            restartCount: 0,
            speedRule: {
              fullScoreMs: 900_000,
              zeroScoreMs: 3_300_000,
              overtimeStepMs: 60_000,
            },
            timeDeltaMs: -775_000,
            score: {
              total: 100,
              breakdown: { accuracy: 40, speed: 40, stability: 20 },
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
});
