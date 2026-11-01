import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { _private as appDecisionSound } from "@/components/app-decision-sound";
import { PlayHeader } from "@/components/PlayHeader";
import {
  isBackgroundMusicEnabled,
  setBackgroundMusicEnabled,
} from "@/lib/background-music-setting";
import { playSound } from "@/lib/sound-effects";
import {
  isSoundEffectsEnabled,
  setSoundEffectsEnabled,
} from "@/lib/sound-effects-setting";

vi.mock("@/lib/sound-effects", () => ({
  defineSoundEffect: (url: string) => ({ url }),
  playSound: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  setSoundEffectsEnabled(true);
  setBackgroundMusicEnabled(true);
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
    onChangeDifficulty: vi.fn(),
    onBackToHome: vi.fn(),
    onOpenHowToPlay: vi.fn(),
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

    test("戻るボタンで難易度変更を通知すること", () => {
      fireEvent.click(screen.getByRole("button", { name: "難易度選択へ戻る" }));

      expect(props.onChangeDifficulty).toHaveBeenCalledOnce();
    });

    test("メニュー項目を補助操作・移動・説明・検証の順に並べること", () => {
      openPlayMenu();

      const itemNames = screen
        .getAllByRole("menuitem")
        .map((item) => item.textContent);

      expect(itemNames).toEqual([
        "盤面を戻す",
        "リセット",
        "別の問題",
        "難易度変更",
        "ホーム",
        "遊び方",
        "検証情報",
      ]);
    });

    const menuCases = [
      ["盤面を戻す", "onRestart"],
      ["リセット", "onReplay"],
      ["別の問題", "onStartNewProblem"],
      ["難易度変更", "onChangeDifficulty"],
      ["ホーム", "onBackToHome"],
      ["遊び方", "onOpenHowToPlay"],
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
      "難易度変更",
      "ホーム",
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
      fireEvent.click(screen.getByRole("button", { name: "難易度選択へ戻る" }));

      expect(playSound).not.toHaveBeenCalled();
    });
  });

  describe("効果音を鳴らす設定の場合", () => {
    beforeEach(() => {
      render(<PlayHeader {...createProps()} />);
      openPlayMenu();
    });

    test("メニューに効果音を鳴らす設定として示すこと", () => {
      const soundEffects = screen.getByRole("menuitemcheckbox", {
        name: "効果音",
      });

      expect(soundEffects.getAttribute("aria-checked")).toBe("true");
    });

    test("メニューの効果音で鳴らさない設定に切り替え、メニューを開いたままにすること", () => {
      fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "効果音" }));

      const soundEffects = screen.getByRole("menuitemcheckbox", {
        name: "効果音",
      });
      expect(soundEffects.getAttribute("aria-checked")).toBe("false");
      expect(isSoundEffectsEnabled()).toBe(false);
    });
  });

  describe("BGM を流す設定の場合", () => {
    beforeEach(() => {
      render(<PlayHeader {...createProps()} />);
      openPlayMenu();
    });

    test("メニューの BGM で流さない設定に切り替え、効果音の設定は変えずにメニューを開いたままにすること", () => {
      fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "BGM" }));

      const backgroundMusic = screen.getByRole("menuitemcheckbox", {
        name: "BGM",
      });
      expect(backgroundMusic.getAttribute("aria-checked")).toBe("false");
      expect(isBackgroundMusicEnabled()).toBe(false);
      expect(isSoundEffectsEnabled()).toBe(true);
    });
  });

  describe("省略できる補助操作を渡さない場合", () => {
    beforeEach(() => {
      const {
        onRestart: _onRestart,
        onReplay: _onReplay,
        onOpenHowToPlay: _onOpenHowToPlay,
        onOpenDiagnostics: _onOpenDiagnostics,
        ...requiredProps
      } = createProps();
      render(<PlayHeader {...requiredProps} />);
    });

    test("移動の操作だけをメニューへ並べること", () => {
      openPlayMenu();

      const itemNames = screen
        .getAllByRole("menuitem")
        .map((item) => item.textContent);

      expect(itemNames).toEqual(["別の問題", "難易度変更", "ホーム"]);
    });
  });
});
