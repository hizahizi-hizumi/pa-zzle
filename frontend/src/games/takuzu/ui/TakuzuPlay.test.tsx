import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type {
  TakuzuProgress,
  TakuzuResult,
} from "@/games/takuzu/play/use-takuzu-play";
import type { TakuzuCellView } from "@/games/takuzu/session/session";
import { takuzuPlayRecordDisplay } from "@/games/takuzu/ui/play-record-display";
import { TakuzuPlay } from "@/games/takuzu/ui/TakuzuPlay";
import { PlayRecordOutcomeNotice } from "@/records/ui/PlayRecordOutcomeNotice";

const cells: TakuzuCellView[] = [
  { cell: "a", given: true, violated: false },
  { cell: "b", given: false, violated: false },
  { cell: "b", given: false, violated: false },
  { cell: "a", given: false, violated: false },
];

/** 基準時間 02:45（10秒 + 44 × 2秒 + 19 × 3秒 + 1 × 10秒）の問題を 03:00 で、置き直し2回・盤面を戻す1回で解いた結果。 */
const result: TakuzuResult = {
  elapsedMs: 180_000,
  correctionCount: 2,
  restartCount: 1,
  inputCount: 70,
  workload: { emptyCellCount: 44, roundCount: 19, lineReadingRoundCount: 1 },
  speedFullScoreMs: 165_000,
  timeDeltaMs: 15_000,
  score: { total: 71, breakdown: { accuracy: 35, speed: 36 } },
};

const perfectResult: TakuzuResult = {
  ...result,
  elapsedMs: 150_000,
  correctionCount: 0,
  restartCount: 0,
  timeDeltaMs: -15_000,
  score: { total: 100, breakdown: { accuracy: 60, speed: 40 } },
};

afterEach(() => {
  cleanup();
});

describe("TakuzuPlay", () => {
  const callbacks = {
    onCycleCell: vi.fn(),
    onPlaceCell: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onClearingComplete: vi.fn(),
    onStartNewProblem: vi.fn(),
    onOpenRecords: vi.fn(),
    onChangeDifficulty: vi.fn(),
    onBackToHome: vi.fn(),
  };

  function renderPlay(
    progress: TakuzuProgress,
    {
      playResult = null,
      onOpenDiagnostics,
    }: {
      playResult?: TakuzuResult | null;
      onOpenDiagnostics?: () => void;
    } = {},
  ) {
    render(
      <TakuzuPlay
        difficulty="2"
        size={2}
        cells={cells}
        progress={progress}
        elapsedMs={65_000}
        result={playResult}
        recordOutcomeNotice={null}
        {...callbacks}
        onOpenDiagnostics={onOpenDiagnostics}
      />,
    );
  }

  function openMenu() {
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "その他の操作" }),
      { button: 0, ctrlKey: false },
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("プレイ中の場合", () => {
    beforeEach(() => {
      renderPlay("playing");
    });

    test("表示名と難易度と経過時間を表示すること", () => {
      const heading = screen.getByRole("heading", { name: "バイナリパズル" });
      const difficulty = screen.getByText("難易度 2");
      const elapsedTime = screen.getByText("時間").parentElement;

      expect(heading).toBeTruthy();
      expect(difficulty).toBeTruthy();
      expect(elapsedTime?.textContent).toBe("時間01:05");
    });

    test("戻るボタンで難易度選択への移動を通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "難易度選択へ戻る" }));

      expect(callbacks.onChangeDifficulty).toHaveBeenCalledOnce();
      expect(callbacks.onBackToHome).not.toHaveBeenCalled();
    });

    const menuCases = [
      ["盤面を戻す", "onRestart"],
      ["リセット", "onReplay"],
      ["別の問題", "onStartNewProblem"],
      ["難易度変更", "onChangeDifficulty"],
      ["ホーム", "onBackToHome"],
    ] as const;

    test.each(menuCases)(
      "メニューの %s で対応する操作を通知すること",
      (itemName, callbackName) => {
        openMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: itemName }));

        expect(callbacks[callbackName]).toHaveBeenCalledOnce();
      },
    );

    test("検証情報のつなぎ先を渡さなければメニューへ検証情報を表示しないこと", () => {
      openMenu();

      const item = screen.queryByRole("menuitem", { name: "検証情報" });

      expect(item).toBeNull();
    });
  });

  describe("検証情報のつなぎ先を渡した場合", () => {
    const onOpenDiagnostics = vi.fn();

    beforeEach(() => {
      renderPlay("playing", { onOpenDiagnostics });
    });

    test("メニューの検証情報で検証情報を開く操作を通知すること", () => {
      openMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      expect(onOpenDiagnostics).toHaveBeenCalledOnce();
    });
  });

  describe("完成演出中の場合", () => {
    beforeEach(() => {
      renderPlay("clearing", { playResult: result });
    });

    test("盤面のマスを操作できないこと", () => {
      const disabled = within(screen.getByRole("group", { name: "盤面" }))
        .getAllByRole("button")
        .every((cell) => (cell as HTMLButtonElement).disabled);

      expect(disabled).toBe(true);
    });

    test("結果画面をまだ出さないこと", () => {
      const resultScreen = screen.queryByRole("region", { name: "プレイ結果" });

      expect(resultScreen).toBeNull();
    });
  });

  describe("完成演出が終わった場合", () => {
    beforeEach(() => {
      renderPlay("result", { playResult: result });
    });

    test("ゲーム名・難易度・スコアを表示すること", () => {
      const heading = screen.getByRole("heading", { name: "プレイ結果" });
      const difficulty = screen.getByText("バイナリパズル").nextElementSibling;
      const score = within(screen.getByRole("region", { name: "スコア" }));

      expect(heading).toBeTruthy();
      expect(difficulty?.textContent).toBe("難易度2");
      expect(score.getByText("71")).toBeTruthy();
    });

    test("時間と基準時間との差・置き直し・盤面を戻した回数を主な成績として表示すること", () => {
      const metrics = screen.getByText("置き直し").closest("dl");

      expect(metrics?.textContent).toBe(
        "時間03:00基準 +00:15置き直し2回盤面を戻す1回",
      );
    });

    test("結果画面へフォーカスを移すこと", () => {
      const focused = document.activeElement;

      expect(focused).toBe(screen.getByRole("region", { name: "プレイ結果" }));
    });

    test("盤面を表示しないこと", () => {
      const board = screen.queryByRole("group", { name: "盤面" });

      expect(board).toBeNull();
    });

    const actionCases = [
      ["プレイ！", "onStartNewProblem"],
      ["同じ問題", "onReplay"],
      ["記録を確認", "onOpenRecords"],
      ["難易度変更", "onChangeDifficulty"],
      ["ホーム", "onBackToHome"],
    ] as const;

    test.each(actionCases)(
      "%s ボタンで対応する操作を通知すること",
      (buttonName, callbackName) => {
        fireEvent.click(screen.getByRole("button", { name: buttonName }));

        expect(callbacks[callbackName]).toHaveBeenCalledOnce();
      },
    );

    test("検証情報のつなぎ先を渡さなければ検証情報ボタンを出さないこと", () => {
      const button = screen.queryByRole("button", { name: "検証情報" });

      expect(button).toBeNull();
    });

    describe("スコアの内訳を開いた場合", () => {
      beforeEach(() => {
        fireEvent.click(
          screen.getByRole("button", { name: "スコアの内訳・採点基準" }),
        );
      });

      test("観点ごとの点数と基準時間と空きマスの数を表示すること", () => {
        const accuracy = screen.getAllByText("正確さ")[0]?.parentElement;
        const speed = screen.getAllByText("速さ")[0]?.parentElement;
        const speedFullScore = screen.getByText("基準時間").parentElement;
        const emptyCells = screen.getByText("空きマス").parentElement;

        expect(accuracy?.textContent).toBe("正確さ35 / 60");
        expect(speed?.textContent).toBe("速さ36 / 40");
        expect(speedFullScore?.textContent).toBe("基準時間02:45");
        expect(emptyCells?.textContent).toBe("空きマス44マス");
      });

      test("基準時間を問題の作業の量から求める式を表示すること", () => {
        const criteria = screen.getByText(/基準時間は/);

        expect(criteria.textContent).toContain(
          "10秒 + 空きマス44 × 2秒 + 探し直し19回 × 3秒 + 行・列全体の読み1回 × 10秒",
        );
        expect(criteria.textContent).toContain("05:30以上で0点");
      });

      test("置き直しと盤面を戻すことの減点を表示すること", () => {
        const criteria = screen.getByText(/置き直しも盤面を戻すことも/);

        expect(criteria.textContent).toContain("置き直し1回につき5点");
        expect(criteria.textContent).toContain("盤面を戻すと1回につき15点減点");
      });
    });
  });

  describe("100点で解いた場合", () => {
    beforeEach(() => {
      renderPlay("result", { playResult: perfectResult });
    });

    test("最高段階として称えること", () => {
      const message = screen.getByText("パーフェクト！");

      expect(message).toBeTruthy();
    });

    test("基準時間より速かった差を負の時間で表示すること", () => {
      const timeDelta = screen.getByText("基準 -00:15");

      expect(timeDelta).toBeTruthy();
    });
  });

  describe("結果画面で検証情報のつなぎ先を渡した場合", () => {
    const onOpenDiagnostics = vi.fn();

    beforeEach(() => {
      renderPlay("result", { playResult: result, onOpenDiagnostics });
    });

    test("検証情報ボタンで検証情報を開く操作を通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "検証情報" }));

      expect(onOpenDiagnostics).toHaveBeenCalledOnce();
    });
  });

  describe("置き直しの自己ベストを更新した場合", () => {
    beforeEach(() => {
      render(
        <TakuzuPlay
          difficulty="2"
          size={2}
          cells={cells}
          progress="result"
          elapsedMs={65_000}
          result={perfectResult}
          recordOutcomeNotice={
            <PlayRecordOutcomeNotice
              outcome={{
                status: "updated",
                updates: [
                  {
                    metricId: "correction-count",
                    previousValue: 3,
                    currentValue: 0,
                  },
                ],
              }}
              display={takuzuPlayRecordDisplay}
            />
          }
          {...callbacks}
        />,
      );
    });

    test("更新した指標と減った回数を表示すること", () => {
      const bestUpdate = screen.getByRole("region", { name: "自己ベスト更新" });

      expect(bestUpdate.textContent).toContain("置き直し");
      expect(bestUpdate.textContent).toContain("3回減");
      expect(bestUpdate.textContent).toContain("3回");
      expect(bestUpdate.textContent).toContain("0回");
    });
  });
});
