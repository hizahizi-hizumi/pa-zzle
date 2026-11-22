import {
  act,
  cleanup,
  fireEvent,
  render as renderWithoutRouter,
  screen,
  within,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import type { WaterSortResult } from "@/games/water-sort/play/use-water-sort-play";
import {
  CLEAR_FINALE_HOLD_MS,
  CLEAR_FINALE_REDUCED_MOTION_HOLD_MS,
} from "@/games/water-sort/ui/board/clear-finale-timing";
import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";
import { WaterSortPlay } from "@/games/water-sort/ui/WaterSortPlay";

/** 結果画面はブランドの帯からホームへ戻るリンクを持つので、ルーターの中で描く。 */
function render(ui: ReactElement) {
  return renderWithoutRouter(ui, { wrapper: MemoryRouter });
}

afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { animate?: Element["animate"] }).animate;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

/** 動かした演出を、`finishRunning` を呼ぶまで終わらせない。呼んだ後に始めた演出は、次に呼ぶまで終わらない。 */
function installStagedAnimations() {
  let finishStage: () => void = () => undefined;
  let stage = new Promise<void>((resolve) => {
    finishStage = resolve;
  });
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: vi.fn(
      () => ({ finished: stage, cancel: vi.fn() }) as unknown as Animation,
    ),
  });
  return {
    async finishRunning() {
      const finishing = stage;
      const finish = finishStage;
      stage = new Promise<void>((resolve) => {
        finishStage = resolve;
      });
      await act(async () => {
        finish();
        await finishing;
      });
    },
  };
}

const baseProps = {
  difficulty: "3" as const,
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
  recordFeedback: { kind: "none" } as const,
  onSelectBottle: vi.fn(),
  onUndo: vi.fn(),
  canRestart: true,
  onRestart: vi.fn(),
  onReplay: vi.fn(),
  onStartNewProblem: vi.fn(),
  onClearAnimationComplete: vi.fn(),
  renderSettingsDialog: () => null,
  onOpenGameHome: vi.fn(),
  onBackToAppHome: vi.fn(),
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
    speedRule: { fullScoreMs: 64_000, zeroScoreMs: 128_000 },
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
    const onOpenGameHome = vi.fn();
    const onBackToAppHome = vi.fn();
    const onOpenDiagnostics = vi.fn();
    render(
      <WaterSortPlay
        {...baseProps}
        onRestart={restart}
        onReplay={replay}
        onStartNewProblem={startNewProblem}
        onOpenGameHome={onOpenGameHome}
        onBackToAppHome={onBackToAppHome}
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
    fireEvent.click(screen.getByRole("menuitem", { name: "問題選択" }));
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "その他の操作" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "パズル選択" }));
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "その他の操作" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));
    expect(restart).toHaveBeenCalledOnce();
    expect(replay).toHaveBeenCalledOnce();
    expect(startNewProblem).toHaveBeenCalledOnce();
    expect(onOpenGameHome).toHaveBeenCalledOnce();
    expect(onBackToAppHome).toHaveBeenCalledOnce();
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

  test("遊び方を自動では開かないこと", () => {
    render(<WaterSortPlay {...baseProps} />);

    const dialog = screen.queryByRole("dialog", {
      name: "ウォーターソートの遊び方",
    });

    expect(dialog).toBeNull();
  });

  test("メニューから遊び方を開けること", () => {
    render(<WaterSortPlay {...baseProps} />);
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "その他の操作" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "遊び方" }));

    const dialog = screen.getByRole("dialog", {
      name: "ウォーターソートの遊び方",
    });

    expect(dialog).toBeTruthy();
  });

  describe("遊び方からチュートリアルを始めた場合", () => {
    beforeEach(() => {
      render(<WaterSortPlay {...baseProps} />);
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "その他の操作" }),
        { button: 0, ctrlKey: false },
      );
      fireEvent.click(screen.getByRole("menuitem", { name: "遊び方" }));
      fireEvent.click(
        screen.getByRole("button", {
          name: "チュートリアルで遊んで覚える",
        }),
      );
    });

    test("チュートリアルを開くこと", () => {
      const dialog = screen.getByRole("dialog", {
        name: "ウォーターソート",
        description: "チュートリアル",
      });

      expect(dialog).toBeTruthy();
    });

    test("閉じるとチュートリアルを閉じて同じプレイの盤面へ戻ること", () => {
      fireEvent.click(
        within(
          screen.getByRole("dialog", {
            name: "ウォーターソート",
            description: "チュートリアル",
          }),
        ).getByRole("button", { name: "閉じる" }),
      );

      const dialog = screen.queryByRole("dialog", { name: "ウォーターソート" });
      const firstBottle = screen
        .getByRole("button", { name: /^ボトル 1:/ })
        .getAttribute("aria-label");

      expect(dialog).toBeNull();
      expect(firstBottle).toBe("ボトル 1: 赤、青");
      expect(baseProps.onReplay).not.toHaveBeenCalled();
    });
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
        progress="result"
        result={createResult()}
      />,
    );
    expect(screen.getByRole("heading", { name: "プレイ結果" })).toBeTruthy();
    expect(screen.getByText("ウォーターソート")).toBeTruthy();
    expect(screen.getByText("01:05")).toBeTruthy();
    expect(screen.getByText("手数")).toBeTruthy();
    expect(screen.getByText("12手")).toBeTruthy();
    expect(screen.getByLabelText("最短手数より多い +2")).toBeTruthy();
    expect(screen.getByLabelText("基準時間より長い +00:01")).toBeTruthy();
    expect(screen.queryByText("手戻り")).toBeNull();
    expect(screen.getByRole("region", { name: "スコア" })).toBeTruthy();
    expect(screen.getByText("87点（100点満点）")).toBeTruthy();
    expect(screen.getByText("ナイスプレイ！")).toBeTruthy();
    expect(screen.getByRole("img", { name: "pa-zzle" })).toBeTruthy();
    expect(screen.getByText("/ 100")).toBeTruthy();
    fireEvent.click(screen.getByText("採点内訳"));
    expect(screen.getByText("手戻り")).toBeTruthy();
    expect(screen.getByText("2手")).toBeTruthy();
    expect(screen.getByText("待った")).toBeTruthy();
    expect(screen.getAllByText("効率")).toHaveLength(2);
    expect(screen.getAllByText("速さ")).toHaveLength(2);
    expect(screen.getAllByText("正確さ")).toHaveLength(2);
    expect(screen.getByText("01:04")).toBeTruthy();
    expect(screen.getByText(/6色 × 1.5秒/)).toBeTruthy();
    expect(screen.queryByText(/seed:/)).toBeNull();
  });

  test("結果画面から診断情報を開けること", () => {
    const onOpenDiagnostics = vi.fn();
    render(
      <WaterSortPlay
        {...baseProps}
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
    expect(screen.getByText("100点（100点満点）")).toBeTruthy();
  });

  describe("注いでいる間に経過時間の表示で描き直した場合", () => {
    const pourOperation = {
      id: 1,
      type: "poured",
      sourceBottleIndex: 0,
      destinationBottleIndex: 1,
      stateBefore: [[0, 1], []],
      stateAfter: [[0], [1]],
      isClearingMove: false,
    } as const;
    let animate: ReturnType<typeof vi.fn>;
    let rerender: ReturnType<typeof render>["rerender"];

    beforeEach(() => {
      animate = vi.fn(
        () =>
          ({
            finished: new Promise(() => undefined),
            cancel: vi.fn(),
          }) as unknown as Animation,
      );
      Object.defineProperty(HTMLElement.prototype, "animate", {
        configurable: true,
        value: animate,
      });
      ({ rerender } = render(
        <WaterSortPlay
          {...baseProps}
          state={pourOperation.stateAfter}
          operation={pourOperation}
        />,
      ));
    });

    test("注ぐ動きをやり直さないこと", () => {
      const startedAnimationCount = animate.mock.calls.length;
      rerender(
        <WaterSortPlay
          {...baseProps}
          elapsedMs={baseProps.elapsedMs + 1000}
          state={pourOperation.stateAfter}
          operation={pourOperation}
          onClearAnimationComplete={vi.fn()}
        />,
      );

      expect(startedAnimationCount).toBeGreaterThan(0);
      expect(animate).toHaveBeenCalledTimes(startedAnimationCount);
    });
  });

  describe("最後の手で盤面をそろえた場合", () => {
    const clearingOperation = {
      id: 1,
      type: "poured",
      sourceBottleIndex: 0,
      destinationBottleIndex: 1,
      stateBefore: [[0], [0, 0, 0], []],
      stateAfter: [[], [0, 0, 0, 0], []],
      isClearingMove: true,
    } as const;
    const clearingProps = {
      ...baseProps,
      progress: "clearing",
      state: clearingOperation.stateAfter,
      operation: clearingOperation,
      canUndo: false,
      onClearAnimationComplete: vi.fn(),
    } as const;

    describe("動きを見せる場合", () => {
      let animations: ReturnType<typeof installStagedAnimations>;
      let rerender: ReturnType<typeof render>["rerender"];

      beforeEach(() => {
        vi.useFakeTimers();
        animations = installStagedAnimations();
        ({ rerender } = render(
          <WaterSortPlay
            {...baseProps}
            state={clearingOperation.stateBefore}
            sourceBottleIndex={0}
          />,
        ));
        rerender(<WaterSortPlay {...clearingProps} />);
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      test("注ぐ動きを終えても、空の試験管を片付ける演出を終えるまで結果へ進まないこと", async () => {
        await animations.finishRunning();
        const completedAfterPour =
          clearingProps.onClearAnimationComplete.mock.calls.length;
        await animations.finishRunning();
        act(() => {
          vi.advanceTimersByTime(CLEAR_FINALE_HOLD_MS);
        });

        expect(completedAfterPour).toBe(0);
        expect(clearingProps.onClearAnimationComplete).toHaveBeenCalledOnce();
      });

      test("片付ける演出の途中に触れると、残りを飛ばして結果へ進むこと", async () => {
        await animations.finishRunning();
        fireEvent.click(screen.getByRole("button", { name: "演出を飛ばす" }));

        expect(clearingProps.onClearAnimationComplete).toHaveBeenCalledOnce();
      });

      describe("片付ける演出の途中にリセットした場合", () => {
        beforeEach(async () => {
          await animations.finishRunning();
        });

        test("前の盤面の演出を残さず、結果へ進まないこと", async () => {
          rerender(
            <WaterSortPlay
              {...baseProps}
              state={clearingOperation.stateBefore}
              onClearAnimationComplete={clearingProps.onClearAnimationComplete}
            />,
          );
          await animations.finishRunning();
          act(() => {
            vi.advanceTimersByTime(CLEAR_FINALE_HOLD_MS);
          });

          expect(
            screen.queryByRole("button", { name: "演出を飛ばす" }),
          ).toBeNull();
          expect(clearingProps.onClearAnimationComplete).not.toHaveBeenCalled();
        });
      });
    });

    describe("動きを減らす設定の場合", () => {
      beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal(
          "matchMedia",
          vi.fn(() => ({ matches: true }) as MediaQueryList),
        );
        const { rerender } = render(
          <WaterSortPlay
            {...baseProps}
            state={clearingOperation.stateBefore}
            sourceBottleIndex={0}
          />,
        );
        rerender(<WaterSortPlay {...clearingProps} />);
      });

      afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
      });

      test("そろった姿を見せてから結果へ進むこと", () => {
        const completedAtOnce =
          clearingProps.onClearAnimationComplete.mock.calls.length;
        act(() => {
          vi.advanceTimersByTime(CLEAR_FINALE_REDUCED_MOTION_HOLD_MS);
        });

        expect(completedAtOnce).toBe(0);
        expect(clearingProps.onClearAnimationComplete).toHaveBeenCalledOnce();
      });
    });
  });

  test("クリア後に次の問題・ゲームのホームへの移動・再挑戦を通知すること", () => {
    const replay = vi.fn();
    const startNewProblem = vi.fn();
    const onOpenGameHome = vi.fn();
    render(
      <WaterSortPlay
        {...baseProps}
        progress="result"
        result={createResult()}
        onReplay={replay}
        onStartNewProblem={startNewProblem}
        onOpenGameHome={onOpenGameHome}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "次の問題" }));
    fireEvent.click(screen.getByRole("button", { name: "問題選択" }));
    fireEvent.click(screen.getByRole("button", { name: "もう一度" }));
    expect(startNewProblem).toHaveBeenCalledOnce();
    expect(onOpenGameHome).toHaveBeenCalledOnce();
    expect(replay).toHaveBeenCalledOnce();
  });

  test("自己ベスト更新内容を表示すること", () => {
    render(
      <WaterSortPlay
        {...baseProps}
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
        recordFeedback={{
          kind: "updated",
          improvements: [
            {
              id: "play-score",
              label: "スコア",
              previous: "92点",
              current: "100点",
              improvement: "+8点",
            },
          ],
        }}
      />,
    );

    const score = screen.getByRole("region", { name: "スコア" });
    expect(score.getAttribute("aria-label")).toBe("スコア");
    expect(
      screen.getByLabelText("スコアの自己ベスト更新：92点から100点、+8点"),
    ).toBeTruthy();
  });
});
