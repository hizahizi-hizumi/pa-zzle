import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import type { TakuzuProgress } from "@/games/takuzu/play/use-takuzu-play";
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
    onClearAnimationComplete: vi.fn(),
    onBackToHome: vi.fn(),
  };

  function renderPlay(progress: TakuzuProgress, canUndo = true) {
    render(
      <TakuzuPlay
        size={2}
        cells={cells}
        lineViolations={[]}
        progress={progress}
        correctionCount={3}
        undoCount={4}
        canUndo={canUndo}
        elapsedMs={65_000}
        {...callbacks}
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

      test("読んでいた時間を除くため、同じ問題を測り直す操作を通知すること", () => {
        expect(callbacks.onReplay).toHaveBeenCalledOnce();
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

    test("戻るボタンでホームへの移動を通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "ホームへ戻る" }));

      expect(callbacks.onBackToHome).toHaveBeenCalledOnce();
    });

    test("遊び方を自動では開かないこと", () => {
      const dialog = screen.queryByRole("dialog", { name: "遊び方" });

      expect(dialog).toBeNull();
    });

    describe("メニューを開いた場合", () => {
      beforeEach(() => {
        openMenu();
      });

      const menuCases = [
        ["盤面を戻す", "onRestart"],
        ["リセット", "onReplay"],
        ["ホーム", "onBackToHome"],
      ] as const;

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

          expect(callbacks.onReplay).not.toHaveBeenCalled();
        });
      });

      describe("つなぎ先を渡していない場合", () => {
        const unconnectedMenuItems = ["別の問題", "難易度変更", "検証情報"];

        test.each(unconnectedMenuItems)("%s を表示しないこと", (itemName) => {
          const result = screen.queryByRole("menuitem", { name: itemName });

          expect(result).toBeNull();
        });
      });
    });

    test("完成の表示を出さないこと", () => {
      const result = screen.queryByRole("status");

      expect(result).toBeNull();
    });
  });

  describe("待ったで戻せる操作がない場合", () => {
    beforeEach(() => {
      renderPlay("playing", false);
    });

    test("待ったボタンを押せないこと", () => {
      const result = screen.getByRole("button", { name: "待った" });

      expect((result as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe("難易度変更と検証情報のつなぎ先を渡した場合", () => {
    const onChangeDifficulty = vi.fn();
    const onOpenDiagnostics = vi.fn();

    beforeEach(() => {
      render(
        <TakuzuPlay
          size={2}
          cells={cells}
          lineViolations={[]}
          progress="playing"
          correctionCount={0}
          undoCount={0}
          canUndo={false}
          elapsedMs={0}
          {...callbacks}
          onChangeDifficulty={onChangeDifficulty}
          onOpenDiagnostics={onOpenDiagnostics}
        />,
      );
    });

    test("戻るボタンで難易度選択への移動を通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "難易度選択へ戻る" }));

      expect(onChangeDifficulty).toHaveBeenCalledOnce();
      expect(callbacks.onBackToHome).not.toHaveBeenCalled();
    });

    test("メニューの難易度変更で難易度選択への移動を通知すること", () => {
      openMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "難易度変更" }));

      expect(onChangeDifficulty).toHaveBeenCalledOnce();
    });

    test("メニューの検証情報で検証情報を開く操作を通知すること", () => {
      openMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "検証情報" }));

      expect(onOpenDiagnostics).toHaveBeenCalledOnce();
    });
  });

  describe("完成演出中の場合", () => {
    beforeEach(() => {
      renderPlay("clearing");
    });

    test("盤面のマスを操作できないこと", () => {
      const result = within(
        screen.getByRole("group", { name: "バイナリパズル盤面" }),
      )
        .getAllByRole("button")
        .every((cell) => (cell as HTMLButtonElement).disabled);

      expect(result).toBe(true);
    });

    test("待ったできないこと", () => {
      const result = screen.getByRole("button", { name: "待った" });

      expect((result as HTMLButtonElement).disabled).toBe(true);
    });

    test("完成の表示をまだ出さないこと", () => {
      const result = screen.queryByRole("status");

      expect(result).toBeNull();
    });
  });

  describe("完成演出が終わった場合", () => {
    beforeEach(() => {
      renderPlay("result");
    });

    test("完成を知らせること", () => {
      const result = screen.getByRole("status");

      expect(result.textContent).toContain("完成！");
    });

    test("同じ問題をもう一度ボタンで再プレイを通知すること", () => {
      fireEvent.click(
        within(screen.getByRole("status")).getByRole("button", {
          name: "同じ問題をもう一度",
        }),
      );

      expect(callbacks.onReplay).toHaveBeenCalledOnce();
    });
  });
});
