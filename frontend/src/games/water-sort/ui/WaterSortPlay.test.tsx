import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { WaterSortResult } from "@/games/water-sort/play/use-water-sort-play";
import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";
import { WaterSortPlay } from "@/games/water-sort/ui/WaterSortPlay";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";

afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { animate?: Element["animate"] }).animate;
  vi.restoreAllMocks();
});

const baseProps = {
  difficulty: "3" as const,
  status: "playing" as const,
  progress: "playing" as const,
  state: [[0, 1], []] as const,
  elapsedMs: 5000,
  moveCount: 7,
  undoCount: 2,
  canUndo: true,
  isDeadlocked: false,
  sourceBottleIndex: null,
  operation: null,
  result: null,
  recordOutcomeNotice: null,
  onSelectBottle: vi.fn(),
  onUndo: vi.fn(),
  onRestart: vi.fn(),
  onReplay: vi.fn(),
  onStartNewProblem: vi.fn(),
  onOpenRecords: vi.fn(),
  onClearingPourComplete: vi.fn(),
  onChangeDifficulty: vi.fn(),
  onBackToHome: vi.fn(),
};

function createResult(
  overrides: Partial<WaterSortResult> = {},
): WaterSortResult {
  return {
    elapsedMs: 65_000,
    moveCount: 14,
    completionMoveCount: 12,
    undoCount: 2,
    restartCount: 0,
    optimalMoveCount: 10,
    moveDelta: 2,
    timeDeltaMs: 1_000,
    backtrackMoveCount: 2,
    speedFullScoreMs: 64_000,
    colorCount: 6,
    score: {
      total: 87,
      breakdown: { efficiency: 32, speed: 39, accuracy: 16 },
    },
    ...overrides,
  };
}

describe("WaterSortPlay", () => {
  test("プレイ中はゲーム名と主要な計測値をミニマルに表示すること", () => {
    const selectBottle = vi.fn();
    render(<WaterSortPlay {...baseProps} onSelectBottle={selectBottle} />);
    const bottle = screen.getByRole("button", { name: "ボトル 1: 赤、青" });
    fireEvent.click(bottle);
    expect(screen.getByRole("img", { name: "pa-zzle" })).toBeTruthy();
    expect(screen.queryByText("パズル pa-zzle")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "ウォーターソート" }),
    ).toBeTruthy();
    expect(screen.getByText("手数")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("時間")).toBeTruthy();
    expect(screen.getByText("00:05")).toBeTruthy();
    expect(screen.getByText("待った")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.queryByText(/最短 9手/)).toBeNull();
    expect(selectBottle).toHaveBeenCalledWith(0);
  });

  test("選択中の注ぎ元だけを選択状態として表すこと", () => {
    render(<WaterSortPlay {...baseProps} sourceBottleIndex={0} />);
    const sourceBottle = screen.getByRole("button", {
      name: "ボトル 1: 赤、青",
    });
    expect(sourceBottle.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("注ぎ元")).toBeNull();
  });

  test("合法手を教えるためにボトル操作を無効化しないこと", () => {
    const selectBottle = vi.fn();
    render(<WaterSortPlay {...baseProps} onSelectBottle={selectBottle} />);
    const bottle = screen.getByRole("button", { name: "ボトル 2: 空" });
    fireEvent.click(bottle);
    expect((bottle as HTMLButtonElement).disabled).toBe(false);
    expect(selectBottle).toHaveBeenCalledWith(1);
  });

  test("手詰まり時だけ進行不能を案内し、待った・盤面を戻すへつなぐこと", () => {
    const undo = vi.fn();
    const restart = vi.fn();
    const { rerender } = render(
      <WaterSortPlay
        {...baseProps}
        isDeadlocked
        onUndo={undo}
        onRestart={restart}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("手詰まり");
    fireEvent.click(screen.getByRole("button", { name: "待った" }));
    fireEvent.click(screen.getByRole("button", { name: "盤面を戻す" }));
    expect(undo).toHaveBeenCalledOnce();
    expect(restart).toHaveBeenCalledOnce();
    rerender(
      <WaterSortPlay
        {...baseProps}
        isDeadlocked={false}
        onUndo={undo}
        onRestart={restart}
      />,
    );
    expect(screen.queryByText("手詰まり")).toBeNull();
  });

  test("注水演出が完了してから手詰まりを案内すること", async () => {
    let resolveAnimation: (() => void) | undefined;
    const animationFinished = new Promise<void>((resolve) => {
      resolveAnimation = resolve;
    });
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: vi.fn(
        () =>
          ({
            finished: animationFinished,
            cancel: vi.fn(),
          }) as unknown as Animation,
      ),
    });
    const { rerender } = render(
      <WaterSortPlay
        {...baseProps}
        state={[[0, 1], []]}
        sourceBottleIndex={0}
      />,
    );

    rerender(
      <WaterSortPlay
        {...baseProps}
        state={[[0], [1]]}
        isDeadlocked
        operation={{
          id: 1,
          type: "poured",
          sourceBottleIndex: 0,
          destinationBottleIndex: 1,
          stateBefore: [[0, 1], []],
          stateAfter: [[0], [1]],
          isClearingMove: false,
        }}
      />,
    );

    expect(screen.queryByText("手詰まり")).toBeNull();

    await act(async () => {
      resolveAnimation?.();
      await animationFinished;
    });

    expect(screen.getByRole("status").textContent).toContain("手詰まり");
  });

  test("注水中に不正操作が発生しても注水終了まで手詰まりを案内しないこと", async () => {
    let resolveAnimation: (() => void) | undefined;
    const animationFinished = new Promise<void>((resolve) => {
      resolveAnimation = resolve;
    });
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: vi.fn(
        () =>
          ({
            finished: animationFinished,
            cancel: vi.fn(),
          }) as unknown as Animation,
      ),
    });
    const { rerender } = render(
      <WaterSortPlay
        {...baseProps}
        state={[[0], [1], []]}
        sourceBottleIndex={0}
      />,
    );

    rerender(
      <WaterSortPlay
        {...baseProps}
        state={[[], [1, 0], []]}
        isDeadlocked
        operation={{
          id: 1,
          type: "poured",
          sourceBottleIndex: 0,
          destinationBottleIndex: 1,
          stateBefore: [[0], [1], []],
          stateAfter: [[], [1, 0], []],
          isClearingMove: false,
        }}
      />,
    );
    rerender(
      <WaterSortPlay
        {...baseProps}
        state={[[], [1, 0], []]}
        isDeadlocked
        operation={{ id: 2, type: "invalid", bottleIndex: 2 }}
      />,
    );

    expect(screen.queryByText("手詰まり")).toBeNull();

    await act(async () => {
      resolveAnimation?.();
      await animationFinished;
    });

    expect(screen.getByRole("status").textContent).toContain("手詰まり");
  });

  test("合法手が残っている通常時は手詰まりを案内しないこと", () => {
    render(<WaterSortPlay {...baseProps} />);
    expect(screen.queryByText("手詰まり")).toBeNull();
  });

  test("待ったをプレイ中の直接操作として通知すること", () => {
    const undo = vi.fn();
    render(<WaterSortPlay {...baseProps} onUndo={undo} />);
    fireEvent.click(screen.getByRole("button", { name: "待った" }));
    expect(undo).toHaveBeenCalledOnce();
  });

  test("二次操作をメニューから通知すること", () => {
    const restart = vi.fn();
    const replay = vi.fn();
    const startNewProblem = vi.fn();
    const onChangeDifficulty = vi.fn();
    const onBackToHome = vi.fn();
    const onOpenDiagnostics = vi.fn();
    render(
      <WaterSortPlay
        {...baseProps}
        onRestart={restart}
        onReplay={replay}
        onStartNewProblem={startNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
        onOpenDiagnostics={onOpenDiagnostics}
      />,
    );
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
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "その他の操作" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "別の問題" }));
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "その他の操作" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "難易度変更" }));
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "その他の操作" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "ホーム" }));
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "その他の操作" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));
    expect(restart).toHaveBeenCalledOnce();
    expect(replay).toHaveBeenCalledOnce();
    expect(startNewProblem).toHaveBeenCalledOnce();
    expect(onChangeDifficulty).toHaveBeenCalledOnce();
    expect(onBackToHome).toHaveBeenCalledOnce();
    expect(onOpenDiagnostics).toHaveBeenCalledOnce();
  });

  test("診断導線が許可されていなければメニューへ表示しないこと", () => {
    render(<WaterSortPlay {...baseProps} />);

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "その他の操作" }),
      { button: 0, ctrlKey: false },
    );

    expect(screen.queryByRole("menuitem", { name: "検証情報" })).toBeNull();
  });

  test("待ったで戻せる手がない操作を無効にすること", () => {
    render(<WaterSortPlay {...baseProps} canUndo={false} />);
    const button = screen.getByRole("button", { name: "待った" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  test("クリア後は主要な結果だけを先に表示すること", () => {
    render(
      <WaterSortPlay
        {...baseProps}
        status="cleared"
        progress="result"
        result={createResult()}
      />,
    );
    expect(screen.getByRole("heading", { name: "プレイ結果" })).toBeTruthy();
    expect(screen.getByText("ウォーターソート")).toBeTruthy();
    expect(screen.getByText("01:05")).toBeTruthy();
    expect(screen.getByText("手数")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("最短 +2")).toBeTruthy();
    expect(screen.getByText("基準 +00:01")).toBeTruthy();
    expect(screen.queryByText("手戻り")).toBeNull();
    expect(screen.getByText("スコア")).toBeTruthy();
    expect(screen.getByText("87")).toBeTruthy();
    expect(screen.getByText("ナイスプレイ！")).toBeTruthy();
    expect(screen.getByText("パズル pa-zzle")).toBeTruthy();
    expect(screen.getByText("/ 100")).toBeTruthy();
    fireEvent.click(screen.getByText("スコアの内訳・採点基準"));
    expect(screen.getByText("手戻り")).toBeTruthy();
    expect(screen.getByText("2手")).toBeTruthy();
    expect(screen.getByText("待った")).toBeTruthy();
    expect(screen.getAllByText("効率")).toHaveLength(2);
    expect(screen.getAllByText("速さ")).toHaveLength(2);
    expect(screen.getAllByText("正確性")).toHaveLength(2);
    expect(screen.getByText("01:04")).toBeTruthy();
    expect(screen.getByText(/6色 × 1.5秒/)).toBeTruthy();
    expect(screen.queryByText(/seed:/)).toBeNull();
  });

  test("結果画面から診断情報を開けること", () => {
    const onOpenDiagnostics = vi.fn();
    render(
      <WaterSortPlay
        {...baseProps}
        status="cleared"
        progress="result"
        result={createResult()}
        onOpenDiagnostics={onOpenDiagnostics}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "検証情報" }));

    expect(onOpenDiagnostics).toHaveBeenCalledOnce();
  });

  test("100点では最高段階として強く称えること", () => {
    render(
      <WaterSortPlay
        {...baseProps}
        status="cleared"
        progress="result"
        result={createResult({
          elapsedMs: 42_000,
          moveCount: 10,
          completionMoveCount: 10,
          undoCount: 0,
          optimalMoveCount: 10,
          moveDelta: 0,
          timeDeltaMs: -22_000,
          backtrackMoveCount: 0,
          score: {
            total: 100,
            breakdown: { efficiency: 40, speed: 40, accuracy: 20 },
          },
        })}
      />,
    );
    expect(screen.getByText("パーフェクト！")).toBeTruthy();
    expect(screen.getByText("100")).toBeTruthy();
  });

  test("最後の注水演出が完了してから結果画面を表示すること", async () => {
    let resolveAnimation: (() => void) | undefined;
    const animationFinished = new Promise<void>((resolve) => {
      resolveAnimation = resolve;
    });
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: vi.fn(
        () =>
          ({
            finished: animationFinished,
            cancel: vi.fn(),
          }) as unknown as Animation,
      ),
    });
    const result = createResult({
      moveCount: 12,
      completionMoveCount: 12,
      undoCount: 0,
      optimalMoveCount: 12,
      moveDelta: 0,
      timeDeltaMs: -9_000,
      backtrackMoveCount: 0,
      speedFullScoreMs: 74_000,
      score: {
        total: 100,
        breakdown: { efficiency: 40, speed: 40, accuracy: 20 },
      },
    });
    const { rerender } = render(
      <WaterSortPlay
        {...baseProps}
        state={[[0], [0, 0, 0]]}
        sourceBottleIndex={0}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "ボトル 2: 赤、赤、赤" }),
    );
    rerender(
      <WaterSortPlay
        {...baseProps}
        status="cleared"
        progress="clearing"
        state={[[], [0, 0, 0, 0]]}
        sourceBottleIndex={null}
        operation={{
          id: 1,
          type: "poured",
          sourceBottleIndex: 0,
          destinationBottleIndex: 1,
          stateBefore: [[0], [0, 0, 0]],
          stateAfter: [[], [0, 0, 0, 0]],
          isClearingMove: true,
        }}
        canUndo={false}
        result={result}
      />,
    );
    expect(screen.queryByRole("heading", { name: "プレイ結果" })).toBeNull();
    await act(async () => {
      resolveAnimation?.();
      await animationFinished;
    });
    expect(baseProps.onClearingPourComplete).toHaveBeenCalledOnce();
  });

  test("クリア後に次の問題・再挑戦・難易度変更・ホーム移動を通知すること", () => {
    const replay = vi.fn();
    const startNewProblem = vi.fn();
    const onChangeDifficulty = vi.fn();
    const onBackToHome = vi.fn();
    render(
      <WaterSortPlay
        {...baseProps}
        status="cleared"
        progress="result"
        result={createResult()}
        onReplay={replay}
        onStartNewProblem={startNewProblem}
        onChangeDifficulty={onChangeDifficulty}
        onBackToHome={onBackToHome}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "プレイ！" }));
    fireEvent.click(screen.getByRole("button", { name: "同じ問題" }));
    fireEvent.click(screen.getByRole("button", { name: "難易度変更" }));
    fireEvent.click(screen.getByRole("button", { name: "ホーム" }));
    expect(startNewProblem).toHaveBeenCalledOnce();
    expect(replay).toHaveBeenCalledOnce();
    expect(onChangeDifficulty).toHaveBeenCalledOnce();
    expect(onBackToHome).toHaveBeenCalledOnce();
  });

  test("自己ベスト更新内容と記録画面への導線を表示すること", () => {
    const onOpenRecords = vi.fn();
    render(
      <WaterSortPlay
        {...baseProps}
        status="cleared"
        progress="result"
        result={createResult({
          elapsedMs: 55_000,
          moveCount: 10,
          completionMoveCount: 10,
          undoCount: 0,
          optimalMoveCount: 10,
          moveDelta: 0,
          timeDeltaMs: -9_000,
          backtrackMoveCount: 0,
          score: {
            total: 100,
            breakdown: { efficiency: 40, speed: 40, accuracy: 20 },
          },
        })}
        recordOutcomeNotice={
          <PlayRecordOutcomeNotice
            outcome={{
              status: "updated",
              updates: [
                {
                  metricId: "play-score",
                  previousValue: 92,
                  currentValue: 100,
                },
              ],
            }}
            display={waterSortPlayRecordDisplay}
          />
        }
        onOpenRecords={onOpenRecords}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "記録を確認" }));

    const bestUpdate = screen.getByRole("region", { name: "自己ベスト更新" });

    expect(bestUpdate.textContent).toContain("スコア");
    expect(bestUpdate.textContent).toContain("92点");
    expect(bestUpdate.textContent).toContain("100点");
    expect(onOpenRecords).toHaveBeenCalledOnce();
  });
});
