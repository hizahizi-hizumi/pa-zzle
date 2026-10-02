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
import {
  readTakuzuHowToPlaySeen,
  writeTakuzuHowToPlaySeen,
} from "@/games/takuzu/ui/how-to-play-seen";
import { TakuzuPlay } from "@/games/takuzu/ui/TakuzuPlay";

const cells: TakuzuCellView[] = [
  { cell: "a", given: true, inViolatingRun: false },
  { cell: "b", given: false, inViolatingRun: false },
  { cell: "b", given: false, inViolatingRun: false },
  { cell: "a", given: false, inViolatingRun: false },
];

/** 基準時間 02:45（10秒 + 44 × 2秒 + 19 × 3秒 + 1 × 10秒）の問題を 03:00 で、置き直し2回・盤面を戻した回数1回・待った3回で解いた結果。 */
const result: TakuzuResult = {
  elapsedMs: 180_000,
  correctionCount: 2,
  restartCount: 1,
  undoCount: 3,
  inputCount: 70,
  workload: { emptyCellCount: 44, roundCount: 19, lineReadingRoundCount: 1 },
  speedFullScoreMs: 165_000,
  speedZeroScoreMs: 330_000,
  timeDeltaMs: 15_000,
  score: { total: 65, breakdown: { accuracy: 29, speed: 36 } },
};

const perfectResult: TakuzuResult = {
  ...result,
  elapsedMs: 150_000,
  correctionCount: 0,
  restartCount: 0,
  undoCount: 0,
  timeDeltaMs: -15_000,
  score: { total: 100, breakdown: { accuracy: 60, speed: 40 } },
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("TakuzuPlay", () => {
  const callbacks = {
    onCycleCell: vi.fn(),
    onPlaceCell: vi.fn(),
    onUndo: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onRestartTiming: vi.fn(),
    onClearAnimationComplete: vi.fn(),
    onStartNewProblem: vi.fn(),
    onOpenRecords: vi.fn(),
    onChangeDifficulty: vi.fn(),
    onBackToHome: vi.fn(),
  };

  function renderPlay(
    progress: TakuzuProgress,
    {
      playResult = null,
      canUndo = true,
      onOpenDiagnostics,
    }: {
      playResult?: TakuzuResult | null;
      canUndo?: boolean;
      onOpenDiagnostics?: () => void;
    } = {},
  ) {
    render(
      <TakuzuPlay
        difficulty="2"
        size={2}
        cells={cells}
        lineViolations={[]}
        progress={progress}
        correctionCount={3}
        undoCount={4}
        canUndo={canUndo}
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
    writeTakuzuHowToPlaySeen();
  });

  describe("初めて遊ぶ場合", () => {
    beforeEach(() => {
      window.localStorage.clear();
      renderPlay("playing");
    });

    test("遊び方を開くこと", () => {
      const dialog = screen.getByRole("dialog", { name: "遊び方" });

      expect(dialog).toBeTruthy();
    });

    describe("遊び方を閉じた場合", () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
      });

      test("読んでいた時間を除くため、やり直しではなく測り直しを通知すること", () => {
        expect(callbacks.onRestartTiming).toHaveBeenCalledOnce();
        expect(callbacks.onReplay).not.toHaveBeenCalled();
      });

      test("次からは自動で開かないよう記録すること", () => {
        expect(readTakuzuHowToPlaySeen()).toBe(true);
      });
    });
  });

  describe("プレイ中の場合", () => {
    beforeEach(() => {
      renderPlay("playing");
    });

    test("表示名と置き直しの回数と経過時間を表示すること", () => {
      const heading = screen.getByRole("heading", { name: "バイナリパズル" });
      const correctionLabel = screen.getByText("置き直し");
      const correctionCount = screen.getByText("3");
      const elapsedTime = screen.getByText("01:05");

      expect(heading).toBeTruthy();
      expect(correctionLabel).toBeTruthy();
      expect(correctionCount).toBeTruthy();
      expect(elapsedTime).toBeTruthy();
    });

    test("待ったの回数を表示すること", () => {
      const header = screen.getByRole("heading", {
        name: "バイナリパズル",
      }).parentElement;
      const undoLabel = within(header as HTMLElement).getByText("待った");
      const undoCount = within(header as HTMLElement).getByText("4");

      expect(undoLabel).toBeTruthy();
      expect(undoCount).toBeTruthy();
    });

    test("待ったボタンで待ったを通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "待った" }));

      expect(callbacks.onUndo).toHaveBeenCalledOnce();
    });

    test("戻るボタンで難易度選択への移動を通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "難易度選択へ戻る" }));

      expect(callbacks.onChangeDifficulty).toHaveBeenCalledOnce();
      expect(callbacks.onBackToHome).not.toHaveBeenCalled();
    });

    describe("メニューを開いた場合", () => {
      beforeEach(() => {
        openMenu();
      });

      const menuCases = [
        ["盤面を戻す", "onRestart"],
        ["リセット", "onReplay"],
        ["別の問題", "onStartNewProblem"],
        ["難易度変更", "onChangeDifficulty"],
        ["ホーム", "onBackToHome"],
      ] as const;

      test("遊び方を自動では開かないこと", () => {
        const dialog = screen.queryByRole("dialog", { name: "遊び方" });

        expect(dialog).toBeNull();
      });

      test.each(menuCases)(
        "%s で対応する操作を通知すること",
        (itemName, callbackName) => {
          fireEvent.click(screen.getByRole("menuitem", { name: itemName }));

          expect(callbacks[callbackName]).toHaveBeenCalledOnce();
        },
      );

      describe("遊び方を選んだ場合", () => {
        beforeEach(() => {
          fireEvent.click(screen.getByRole("menuitem", { name: "遊び方" }));
        });

        test("遊び方を開くこと", () => {
          const dialog = screen.getByRole("dialog", { name: "遊び方" });

          expect(dialog).toBeTruthy();
        });

        test("閉じてもプレイを測り直さないこと", () => {
          fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

          expect(callbacks.onRestartTiming).not.toHaveBeenCalled();
        });
      });

      describe("検証情報のつなぎ先を渡していない場合", () => {
        test("検証情報を表示しないこと", () => {
          const item = screen.queryByRole("menuitem", { name: "検証情報" });

          expect(item).toBeNull();
        });
      });
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

  describe("待ったで戻せる操作がない場合", () => {
    beforeEach(() => {
      renderPlay("playing", { canUndo: false });
    });

    test("待ったボタンを押せないこと", () => {
      const result = screen.getByRole("button", { name: "待った" });

      expect((result as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe("完成演出中の場合", () => {
    beforeEach(() => {
      renderPlay("clearing", { playResult: result });
    });

    test("盤面のマスを操作できないこと", () => {
      const disabled = within(
        screen.getByRole("group", { name: "バイナリパズル盤面" }),
      )
        .getAllByRole("button")
        .every((cell) => (cell as HTMLButtonElement).disabled);

      expect(disabled).toBe(true);
    });

    test("待ったできないこと", () => {
      const undoButton = screen.getByRole("button", { name: "待った" });

      expect((undoButton as HTMLButtonElement).disabled).toBe(true);
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

    test("共通の結果階層でゲーム名・難易度・スコアを表示すること", () => {
      const brand = screen.getByRole("img", { name: "pa-zzle" });
      const heading = screen.getByRole("heading", { name: "プレイ結果" });
      const pictogram = document.querySelector(
        'svg[aria-label="バイナリパズル"]',
      );
      const difficulty = screen.getByText("レベル 2");
      const score = within(screen.getByRole("region", { name: "スコア" }));

      expect(brand).toBeTruthy();
      expect(heading).toBeTruthy();
      expect(pictogram).toBeTruthy();
      expect(difficulty).toBeTruthy();
      expect(score.getByText("65")).toBeTruthy();
    });

    test("時間と基準時間との差・置き直し・待ったを主な成績として表示すること", () => {
      const terms = screen.getAllByRole("term").map((term) => term.textContent);
      const definitions = screen
        .getAllByRole("definition")
        .map((definition) => definition.textContent);

      expect(terms).toEqual(["時間", "置き直し", "待った"]);
      expect(definitions).toEqual(["03:00", "基準 +00:15", "2", "3"]);
    });

    test("結果画面へフォーカスを移すこと", () => {
      const focused = document.activeElement;

      expect(focused).toBe(screen.getByRole("region", { name: "プレイ結果" }));
    });

    test("盤面を表示しないこと", () => {
      const board = screen.queryByRole("group", { name: "バイナリパズル盤面" });

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

    describe("検証情報のつなぎ先を渡していない場合", () => {
      test("検証情報ボタンを出さないこと", () => {
        const button = screen.queryByRole("button", { name: "検証情報" });

        expect(button).toBeNull();
      });
    });

    describe("スコアの内訳を開いた場合", () => {
      beforeEach(() => {
        fireEvent.click(
          screen.getByRole("button", { name: "スコアの内訳・採点基準" }),
        );
      });

      const detailLabels = [
        "正確性",
        "速さ",
        "盤面戻し",
        "基準時間",
        "空きマス",
        "確定マスを探す局面",
        "行・列を読む局面",
      ];
      const detailValues = [
        "29 / 60",
        "36 / 40",
        "1回",
        "02:45",
        "44マス",
        "19回",
        "1回",
      ];

      test("観点ごとの点数と盤面戻しの回数と基準時間と作業の量を内訳に表示すること", () => {
        const terms = screen
          .getAllByRole("term")
          .map((term) => term.textContent);
        const definitions = screen
          .getAllByRole("definition")
          .map((definition) => definition.textContent);

        expect(terms).toEqual(expect.arrayContaining(detailLabels));
        expect(definitions).toEqual(expect.arrayContaining(detailValues));
      });

      test("基準時間を問題の作業の量から求める式と0点になる時間を表示すること", () => {
        const criteria = screen.getByText(/基準時間は/);

        expect(criteria.textContent).toBe(
          "基準時間02:45以内で40点、05:30以上で0点、その間は時間に応じて減点。基準時間は10秒 + 空きマス44 × 2秒 + 確定マスを探す局面19回 × 3秒 + 行・列を読む局面1回 × 10秒。局面の数は、この問題を推測なしに解くときに要る回数で、最初に探す1回も含みます。",
        );
      });

      test("置き直しと盤面戻しと待ったの減点と数え方を表示すること", () => {
        const criteria = screen.getByText(/置き直し1回につき/);

        expect(criteria.textContent).toBe(
          "置き直し1回につき5点、盤面戻し1回につき15点、待った1回につき2点を減点（満点60点）。置き直しは、一度置いたタイルを別のマスへ移ってから変えた回数で、続けて押してタイルを選ぶ間と、待ったで取り消した操作は数えません。盤面戻しは、メニューの「盤面を戻す」を使った回数です。",
        );
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
});
