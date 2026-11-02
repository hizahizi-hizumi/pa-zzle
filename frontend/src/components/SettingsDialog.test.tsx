import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { _private as appDecisionSound } from "@/components/app-decision-sound";
import { SettingsDialog } from "@/components/SettingsDialog";
import { backgroundMusicVolumeSetting } from "@/lib/background-music-setting";
import { playSound } from "@/lib/sound-effects";
import { soundEffectsVolumeSetting } from "@/lib/sound-effects-setting";
import { DEFAULT_VOLUME } from "@/lib/stored-volume-setting";

vi.mock("@/lib/sound-effects", () => ({
  defineSoundEffect: (url: string) => ({ url }),
  playSound: vi.fn(),
}));

/** 音量の行を、その名前の付いたまとまりとして取得する。 */
function getVolumeRow(name: string): HTMLElement {
  return screen.getByRole("group", { name });
}

function readStored(storageKey: string): unknown {
  const stored = window.localStorage.getItem(storageKey);
  return stored === null ? null : JSON.parse(stored);
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.mocked(playSound).mockClear();
  vi.unstubAllGlobals();
  soundEffectsVolumeSetting.commitVolume(DEFAULT_VOLUME);
  backgroundMusicVolumeSetting.commitVolume(DEFAULT_VOLUME);
  window.localStorage.clear();
});

describe("SettingsDialog", () => {
  describe("開いている場合", () => {
    let onOpenChange: (open: boolean) => void;

    beforeEach(() => {
      onOpenChange = vi.fn();
      render(<SettingsDialog open onOpenChange={onOpenChange} />);
    });

    test("効果音と BGM の音量を、はじめの音量で示すこと", () => {
      const dialog = screen.getByRole("dialog", { name: "設定" });

      const volumes = ["効果音", "BGM"].map((name) => {
        const row = within(dialog).getByRole("group", { name });
        return {
          text: within(row).getByText("5").textContent,
          slider: within(row).getByRole("slider").getAttribute("aria-valuenow"),
        };
      });

      expect(volumes).toEqual([
        { text: "5", slider: "5" },
        { text: "5", slider: "5" },
      ]);
    });

    test("効果音の音量を下げると保存し、選んだ音量で確かめの音を鳴らすこと", () => {
      const slider = within(getVolumeRow("効果音")).getByRole("slider");

      fireEvent.keyDown(slider, { key: "ArrowLeft" });

      expect(soundEffectsVolumeSetting.getVolume()).toBe(4);
      expect(readStored("pa-zzle.sound-effects-volume.v1")).toEqual({
        volume: 4,
        unmutedVolume: 4,
      });
      expect(backgroundMusicVolumeSetting.getVolume()).toBe(5);
      expect(playSound).toHaveBeenCalledExactlyOnceWith(
        appDecisionSound.playStartSound,
      );
    });

    test("BGM の音量を上げると保存し、音を鳴らさないこと", () => {
      const slider = within(getVolumeRow("BGM")).getByRole("slider");

      fireEvent.keyDown(slider, { key: "ArrowRight" });

      expect(backgroundMusicVolumeSetting.getVolume()).toBe(6);
      expect(readStored("pa-zzle.background-music-volume.v1")).toEqual({
        volume: 6,
        unmutedVolume: 6,
      });
      expect(soundEffectsVolumeSetting.getVolume()).toBe(5);
      expect(playSound).not.toHaveBeenCalled();
    });

    test("消音のボタンで音量を 0 にし、音を鳴らさないこと", () => {
      const row = getVolumeRow("効果音");

      fireEvent.click(
        within(row).getByRole("button", { name: "効果音を消音" }),
      );

      expect(within(row).getByText("0")).toBeTruthy();
      expect(
        within(row)
          .getByRole("button", { name: "効果音を消音" })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      expect(soundEffectsVolumeSetting.getVolume()).toBe(0);
      expect(playSound).not.toHaveBeenCalled();
    });

    describe("BGM を消音している場合", () => {
      beforeEach(() => {
        fireEvent.click(screen.getByRole("button", { name: "BGMを消音" }));
      });

      test("もう一度押すと、消音する前の音量に戻すこと", () => {
        fireEvent.click(screen.getByRole("button", { name: "BGMを消音" }));

        expect(within(getVolumeRow("BGM")).getByText("5")).toBeTruthy();
        expect(backgroundMusicVolumeSetting.getVolume()).toBe(5);
      });
    });

    test("閉じるボタンで閉じる操作を知らせること", () => {
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

      expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    });
  });

  describe("開くボタンを渡して閉じている場合", () => {
    let onOpenChange: (open: boolean) => void;

    beforeEach(() => {
      onOpenChange = vi.fn();
      render(
        <SettingsDialog
          open={false}
          onOpenChange={onOpenChange}
          trigger={<button type="button">設定を開く</button>}
        />,
      );
    });

    test("開くボタンで開く操作を知らせること", () => {
      fireEvent.click(screen.getByRole("button", { name: "設定を開く" }));

      expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(true);
    });
  });
});
