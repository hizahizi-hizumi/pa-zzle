import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { waterSortPlayRecordDisplay } from "@/games/water-sort/ui/play-record-display";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";

import type { WaterSortResult } from "../play/use-water-sort-play";
import { WaterSortPlay } from "./WaterSortPlay";

afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { animate?: Element["animate"] }).animate;
  vi.restoreAllMocks();
});

type WaterSortPlayProps = Parameters<typeof WaterSortPlay>[0];

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
  let props: WaterSortPlayProps;

  beforeEach(() => {
    props = {
      difficulty: "normal",
      status: "playing",
      progress: "playing",
      state: [[0, 1], []],
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
  });

  describe("プレイ中の場合", () => {
    beforeEach(() => {
      render(<WaterSortPlay {...props} />);
    });

    test("ゲーム名と主要な計測値をミニマルに表示すること", () => {
      const board = within(screen.getByRole("main"));
      const bottle = board.getByRole("button", { name: "ボトル 1: 赤、青" });

      fireEvent.click(bottle);

      expect(screen.getByText("パズル pa-zzle")).toBeTruthy();
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
      expect(props.onSelectBottle).toHaveBeenCalledWith(0);
    });

    test("合法手を教えるためにボトル操作を無効化しないこと", () => {
      const board = within(screen.getByRole("main"));
      const bottle = board.getByRole("button", { name: "ボトル 2: 空" });

      fireEvent.click(bottle);

      expect((bottle as HTMLButtonElement).disabled).toBe(false);
      expect(props.onSelectBottle).toHaveBeenCalledWith(1);
    });

    test("合法手が残っていれば手詰まりを案内しないこと", () => {
      const notice = screen.queryByText("手詰まり");

      expect(notice).toBeNull();
    });

    test("待ったを直接操作として通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "待った" }));

      expect(props.onUndo).toHaveBeenCalledOnce();
    });

    test("診断導線が許可されていなければメニューへ表示しないこと", () => {
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "その他の操作" }),
        { button: 0, ctrlKey: false },
      );
      const menu = within(screen.getByRole("menu"));

      expect(menu.queryByRole("menuitem", { name: "検証情報" })).toBeNull();
    });
  });

  describe("注ぎ元を選択している場合", () => {
    beforeEach(() => {
      render(<WaterSortPlay {...props} sourceBottleIndex={0} />);
    });

    test("選択中の注ぎ元だけを選択状態として表すこと", () => {
      const board = within(screen.getByRole("main"));
      const sourceBottle = board.getByRole("button", {
        name: "ボトル 1: 赤、青",
      });

      expect(sourceBottle.getAttribute("aria-pressed")).toBe("true");
      expect(screen.queryByText("注ぎ元")).toBeNull();
    });
  });

  describe("手詰まりの場合", () => {
    let rerender: ReturnType<typeof render>["rerender"];

    beforeEach(() => {
      ({ rerender } = render(<WaterSortPlay {...props} isDeadlocked />));
    });

    test("進行不能を案内し待った・盤面を戻すへつなぐこと", () => {
      expect(screen.getByRole("status").textContent).toContain("手詰まり");

      fireEvent.click(screen.getByRole("button", { name: "待った" }));
      fireEvent.click(screen.getByRole("button", { name: "盤面を戻す" }));

      expect(props.onUndo).toHaveBeenCalledOnce();
      expect(props.onRestart).toHaveBeenCalledOnce();

      rerender(<WaterSortPlay {...props} isDeadlocked={false} />);

      expect(screen.queryByText("手詰まり")).toBeNull();
    });
  });

  describe("注水演出後に手詰まりになる場合", () => {
    let resolveAnimation: (() => void) | undefined;
    let animationFinished: Promise<void>;
    let rerender: ReturnType<typeof render>["rerender"];

    beforeEach(() => {
      animationFinished = new Promise<void>((resolve) => {
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
      ({ rerender } = render(
        <WaterSortPlay {...props} state={[[0, 1], []]} sourceBottleIndex={0} />,
      ));
    });

    test("注水演出が完了してから手詰まりを案内すること", async () => {
      rerender(
        <WaterSortPlay
          {...props}
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
  });

  describe("注水中に不正操作が発生して手詰まりになる場合", () => {
    let resolveAnimation: (() => void) | undefined;
    let animationFinished: Promise<void>;
    let rerender: ReturnType<typeof render>["rerender"];

    beforeEach(() => {
      animationFinished = new Promise<void>((resolve) => {
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
      ({ rerender } = render(
        <WaterSortPlay
          {...props}
          state={[[0], [1], []]}
          sourceBottleIndex={0}
        />,
      ));
    });

    test("注水終了まで手詰まりを案内しないこと", async () => {
      rerender(
        <WaterSortPlay
          {...props}
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
          {...props}
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
  });

  describe("二次操作メニューを開ける場合", () => {
    beforeEach(() => {
      props.onOpenDiagnostics = vi.fn();
      render(<WaterSortPlay {...props} />);
    });

    test("二次操作をメニューから通知すること", () => {
      const menuButton = screen.getByRole("button", { name: "その他の操作" });
      const menuItems = [
        ["盤面を戻す", props.onRestart],
        ["リセット", props.onReplay],
        ["別の問題", props.onStartNewProblem],
        ["難易度変更", props.onChangeDifficulty],
        ["ホーム", props.onBackToHome],
        ["検証情報", props.onOpenDiagnostics],
      ] as const;

      for (const [name] of menuItems) {
        fireEvent.pointerDown(menuButton, { button: 0, ctrlKey: false });
        fireEvent.click(
          within(screen.getByRole("menu")).getByRole("menuitem", { name }),
        );
      }

      for (const [, callback] of menuItems) {
        expect(callback).toHaveBeenCalledOnce();
      }
    });
  });

  describe("待ったで戻せる手がない場合", () => {
    beforeEach(() => {
      render(<WaterSortPlay {...props} canUndo={false} />);
    });

    test("待った操作を無効にすること", () => {
      const button = screen.getByRole("button", { name: "待った" });

      expect((button as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe("クリア結果を表示している場合", () => {
    beforeEach(() => {
      render(
        <WaterSortPlay
          {...props}
          status="cleared"
          progress="result"
          result={createResult()}
        />,
      );
    });

    test("主要な結果だけを先に表示すること", () => {
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

    test("次の問題・再挑戦・難易度変更・ホーム移動を通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "プレイ！" }));
      fireEvent.click(screen.getByRole("button", { name: "同じ問題" }));
      fireEvent.click(screen.getByRole("button", { name: "難易度変更" }));
      fireEvent.click(screen.getByRole("button", { name: "ホーム" }));

      expect(props.onStartNewProblem).toHaveBeenCalledOnce();
      expect(props.onReplay).toHaveBeenCalledOnce();
      expect(props.onChangeDifficulty).toHaveBeenCalledOnce();
      expect(props.onBackToHome).toHaveBeenCalledOnce();
    });
  });

  describe("結果画面で診断導線が許可されている場合", () => {
    beforeEach(() => {
      props.onOpenDiagnostics = vi.fn();
      render(
        <WaterSortPlay
          {...props}
          status="cleared"
          progress="result"
          result={createResult()}
        />,
      );
    });

    test("診断情報を開けること", () => {
      fireEvent.click(screen.getByRole("button", { name: "検証情報" }));

      expect(props.onOpenDiagnostics).toHaveBeenCalledOnce();
    });
  });

  describe("100点でクリアした場合", () => {
    const perfectResult = createResult({
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
    });

    beforeEach(() => {
      render(
        <WaterSortPlay
          {...props}
          status="cleared"
          progress="result"
          result={perfectResult}
        />,
      );
    });

    test("最高段階として強く称えること", () => {
      expect(screen.getByText("パーフェクト！")).toBeTruthy();
      expect(screen.getByText("100")).toBeTruthy();
    });
  });

  describe("最後の注水演出中の場合", () => {
    const clearingResult = createResult({
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
    let resolveAnimation: (() => void) | undefined;
    let animationFinished: Promise<void>;
    let rerender: ReturnType<typeof render>["rerender"];

    beforeEach(() => {
      animationFinished = new Promise<void>((resolve) => {
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
      ({ rerender } = render(
        <WaterSortPlay
          {...props}
          state={[[0], [0, 0, 0]]}
          sourceBottleIndex={0}
        />,
      ));
    });

    test("演出が完了してから結果表示へ進むこと", async () => {
      const board = within(screen.getByRole("main"));
      fireEvent.click(
        board.getByRole("button", { name: "ボトル 2: 赤、赤、赤" }),
      );
      rerender(
        <WaterSortPlay
          {...props}
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
          result={clearingResult}
        />,
      );

      expect(screen.queryByRole("heading", { name: "プレイ結果" })).toBeNull();

      await act(async () => {
        resolveAnimation?.();
        await animationFinished;
      });

      expect(props.onClearingPourComplete).toHaveBeenCalledOnce();
    });
  });

  describe("自己ベストを更新した結果の場合", () => {
    const perfectResult = createResult({
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
    });

    beforeEach(() => {
      render(
        <WaterSortPlay
          {...props}
          status="cleared"
          progress="result"
          result={perfectResult}
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
        />,
      );
    });

    test("更新内容と記録画面への導線を表示すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "記録を確認" }));
      const bestUpdate = screen.getByRole("region", { name: "自己ベスト更新" });

      expect(bestUpdate.textContent).toContain("スコア");
      expect(bestUpdate.textContent).toContain("92点");
      expect(bestUpdate.textContent).toContain("100点");
      expect(props.onOpenRecords).toHaveBeenCalledOnce();
    });
  });
});
