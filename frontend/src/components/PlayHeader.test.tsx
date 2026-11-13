import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { _private as appDecisionSound } from "@/components/app-decision-sound";
import { PlayHeader } from "@/components/PlayHeader";
import { playSound } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({
  defineSoundEffect: (url: string) => ({ url }),
  playSound: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

function openPlayMenu(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "その他の操作" }), {
    button: 0,
    ctrlKey: false,
  });
}

function createProps(): ComponentProps<typeof PlayHeader> {
  return {
    title: "テストパズル",
    metrics: [
      { type: "count", label: "ミス", count: 2 },
      { type: "elapsed-time", elapsedMs: 65_000 },
    ],
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onStartNewProblem: vi.fn(),
    onOpenGameHome: vi.fn(),
    onBackToAppHome: vi.fn(),
    onOpenHowToPlay: vi.fn(),
    onOpenTutorial: vi.fn(),
    onOpenDiagnostics: vi.fn(),
  };
}

describe("PlayHeader", () => {
  describe("すべての補助操作を渡した場合", () => {
    let props: ComponentProps<typeof PlayHeader>;

    beforeEach(() => {
      props = createProps();
      render(<PlayHeader {...props} />);
    });

    test("ゲーム名と計測値を表示すること", () => {
      const title = screen.getByRole("heading", { name: "テストパズル" });
      const elapsed = screen.getByText("01:05");

      expect(title).toBeTruthy();
      expect(elapsed).toBeTruthy();
    });

    test("戻るボタンでゲームのホームへ移る操作を通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "問題選択へ戻る" }));

      expect(props.onOpenGameHome).toHaveBeenCalledOnce();
    });

    test("メニュー項目を補助操作・移動・説明・設定・検証の順に並べること", () => {
      openPlayMenu();

      const itemNames = screen
        .getAllByRole("menuitem")
        .map((item) => item.textContent);

      expect(itemNames).toEqual([
        "盤面を戻す",
        "リセット",
        "別の問題",
        "問題選択",
        "パズル選択",
        "遊び方",
        "チュートリアル",
        "設定",
        "検証情報",
      ]);
    });

    const menuCases = [
      ["盤面を戻す", "onRestart"],
      ["リセット", "onReplay"],
      ["別の問題", "onStartNewProblem"],
      ["問題選択", "onOpenGameHome"],
      ["パズル選択", "onBackToAppHome"],
      ["遊び方", "onOpenHowToPlay"],
      ["チュートリアル", "onOpenTutorial"],
      ["検証情報", "onOpenDiagnostics"],
    ] as const;

    test.each(menuCases)(
      "メニューの %s で対応する操作を通知すること",
      (itemName, callbackName) => {
        openPlayMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: itemName }));

        expect(props[callbackName]).toHaveBeenCalledOnce();
      },
    );

    test("メニューの別の問題でプレイを始める音を鳴らすこと", () => {
      openPlayMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "別の問題" }));

      expect(playSound).toHaveBeenCalledExactlyOnceWith(
        appDecisionSound.playStartSound,
      );
    });

    const silentMenuItems = [
      "盤面を戻す",
      "リセット",
      "問題選択",
      "パズル選択",
      "遊び方",
      "検証情報",
    ] as const;

    test.each(silentMenuItems)(
      "メニューの %s では音を鳴らさないこと",
      (itemName) => {
        openPlayMenu();
        fireEvent.click(screen.getByRole("menuitem", { name: itemName }));

        expect(playSound).not.toHaveBeenCalled();
      },
    );

    test("戻るボタンでは音を鳴らさないこと", () => {
      fireEvent.click(screen.getByRole("button", { name: "問題選択へ戻る" }));

      expect(playSound).not.toHaveBeenCalled();
    });
  });

  describe("メニューを開いた場合", () => {
    let props: ComponentProps<typeof PlayHeader>;

    beforeEach(() => {
      vi.stubGlobal(
        "ResizeObserver",
        class {
          observe() {}
          unobserve() {}
          disconnect() {}
        },
      );
      props = createProps();
      render(<PlayHeader {...props} />);
      openPlayMenu();
    });

    test("メニューの設定で、画面を移らずに効果音と BGM の音量を選ぶダイアログを開くこと", () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "設定" }));

      const settings = screen.getByRole("dialog", { name: "設定" });
      fireEvent.click(
        within(settings).getByRole("button", { name: /サウンド/ }),
      );
      const dialog = screen.getByRole("dialog", { name: "サウンド" });
      const volumeNames = ["効果音", "BGM"].map(
        (name) => within(dialog).getByRole("group", { name }).textContent,
      );
      expect(volumeNames).toEqual(["効果音5", "BGM5"]);
      expect(props.onBackToAppHome).not.toHaveBeenCalled();
      expect(props.onOpenGameHome).not.toHaveBeenCalled();
      expect(playSound).not.toHaveBeenCalled();
    });
  });

  describe("省略できる補助操作を渡さない場合", () => {
    beforeEach(() => {
      const {
        onRestart: _onRestart,
        onReplay: _onReplay,
        onOpenHowToPlay: _onOpenHowToPlay,
        onOpenTutorial: _onOpenTutorial,
        onOpenDiagnostics: _onOpenDiagnostics,
        ...requiredProps
      } = createProps();
      render(<PlayHeader {...requiredProps} />);
    });

    test("移動の操作と設定だけをメニューへ並べること", () => {
      openPlayMenu();

      const itemNames = screen
        .getAllByRole("menuitem")
        .map((item) => item.textContent);

      expect(itemNames).toEqual(["別の問題", "問題選択", "パズル選択", "設定"]);
    });
  });

  describe("問題の条件を計測値に渡した場合", () => {
    beforeEach(() => {
      render(
        <PlayHeader
          {...createProps()}
          metrics={[
            { type: "problem-fact", text: "5手詰" },
            { type: "elapsed-time", elapsedMs: 65_000 },
          ]}
        />,
      );
    });

    test("ゲームが渡した文言をそのまま表示すること", () => {
      const fact = screen.getByText("5手詰");

      expect(fact).toBeTruthy();
    });
  });
});
