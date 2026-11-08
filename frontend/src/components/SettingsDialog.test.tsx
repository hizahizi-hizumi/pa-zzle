import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { _private as appDecisionSound } from "@/components/app-decision-sound";
import { GameCatalogProvider } from "@/components/GameCatalogContext";
import { SettingsDialog } from "@/components/SettingsDialog";
import { backgroundMusicVolumeSetting } from "@/lib/background-music-setting";
import {
  _private as gameOrderPrivate,
  gameSelectionOrderSetting,
} from "@/lib/game-selection-order-setting";
import {
  randomProblemSettings,
  _private as randomSettingsPrivate,
} from "@/lib/random-problem-settings";
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
  randomSettingsPrivate.reset();
  gameOrderPrivate.resetCache();
});

describe("SettingsDialog", () => {
  describe("開いている場合", () => {
    let onOpenChange: (open: boolean) => void;

    beforeEach(() => {
      onOpenChange = vi.fn();
      render(<SettingsDialog open onOpenChange={onOpenChange} />);
      fireEvent.click(screen.getByRole("button", { name: /サウンド/ }));
    });

    test("効果音と BGM の音量を、はじめの音量で示すこと", () => {
      const dialog = screen.getByRole("dialog", { name: "サウンド" });

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

describe("ランダム出題の設定", () => {
  test("パズルを指定せず開くと適用先が全パズルになること", () => {
    render(<SettingsDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /ランダム出題/ }));
    const scope = screen.getByLabelText("適用先") as HTMLSelectElement;

    expect(scope.value).toBe("global");
    expect(screen.getByText("全パズル")).toBeTruthy();
    expect(screen.getByText("クリア済み")).toBeTruthy();
  });

  test("共通の6状態を切り替えて保存し、ゲーム個別の上書きを作成・解除できること", () => {
    render(
      <GameCatalogProvider games={[{ id: "nanpure", name: "ナンプレ" }]}>
        <SettingsDialog open onOpenChange={vi.fn()} />
      </GameCatalogProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /ランダム出題/ }));
    const dialog = within(screen.getByRole("dialog", { name: "ランダム出題" }));
    expect(dialog.getAllByRole("checkbox")).toHaveLength(6);
    fireEvent.click(dialog.getByRole("checkbox", { name: /perfect/ }));
    expect(randomProblemSettings.getSnapshot().global).not.toContain("perfect");

    fireEvent.change(dialog.getByLabelText("適用先"), {
      target: { value: "nanpure" },
    });
    expect(dialog.getAllByRole("checkbox")).toHaveLength(6);
    expect(dialog.queryByText(/全パズルの設定を使用中/)).toBeNull();
    expect(dialog.queryByRole("button", { name: "共通に戻す" })).toBeNull();
    expect(dialog.getByRole("option", { name: "ナンプレ" })).toBeTruthy();
    expect(
      randomProblemSettings.getSnapshot().overrides.nanpure,
    ).toBeUndefined();
    fireEvent.click(dialog.getByRole("checkbox", { name: /perfect/ }));
    expect(randomProblemSettings.getEffective("nanpure")).toContain("perfect");
    expect(randomProblemSettings.getSnapshot().overrides.nanpure).toContain(
      "perfect",
    );
    expect(randomProblemSettings.getSnapshot().global).not.toContain("perfect");
    expect(dialog.getByRole("option", { name: "ナンプレ" })).toBeTruthy();
    expect(dialog.getByRole("button", { name: "共通に戻す" })).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "共通に戻す" }));
    expect(randomProblemSettings.getEffective("nanpure")).not.toContain(
      "perfect",
    );
    expect(
      randomProblemSettings.getSnapshot().overrides.nanpure,
    ).toBeUndefined();
    expect(dialog.getAllByRole("checkbox")).toHaveLength(6);
  });
});

describe("パズルの並び順の設定", () => {
  beforeEach(() => {
    render(
      <GameCatalogProvider
        games={[
          { id: "water-sort", name: "ウォーターソート" },
          { id: "nanpure", name: "ナンプレ" },
        ]}
      >
        <SettingsDialog open onOpenChange={vi.fn()} />
      </GameCatalogProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /パズルの並び順/ }));
  });

  test("上へ移動した順番を保存すること", () => {
    const dialog = within(
      screen.getByRole("dialog", { name: "パズルの並び順" }),
    );
    const list = dialog.getByRole("list", { name: "パズルの並び順" });
    fireEvent.keyDown(
      dialog.getByRole("button", { name: "ナンプレを並び替え" }),
      { key: "ArrowUp" },
    );
    const names = within(list)
      .getAllByRole("listitem")
      .map((item) => item.textContent?.trim());

    expect(names[0]).toBe("ナンプレ");
    expect(names[1]).toBe("ウォーターソート");
    expect(gameSelectionOrderSetting.getSnapshot().slice(0, 2)).toEqual([
      "nanpure",
      "water-sort",
    ]);
  });

  test("ドラッグ先へ並べ替えて保存し、移動中だけ配置場所を示すこと", () => {
    const list = screen.getByRole("list", { name: "パズルの並び順" });
    const handle = screen.getByRole("button", { name: "ナンプレを並び替え" });
    const rowPositions = vi
      .spyOn(HTMLElement.prototype, "offsetTop", "get")
      .mockImplementation(function (this: HTMLElement) {
        return Array.from(list.children).indexOf(this) * 48;
      });
    const rowHeights = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(48);
    const bounds = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        const index = Array.from(list.children).indexOf(this);
        const top = this === list ? 100 : 100 + index * 48;
        return {
          x: 0,
          y: top,
          top,
          left: 0,
          width: 320,
          height: 48,
          right: 320,
          bottom: top + 48,
          toJSON() {},
        };
      });

    fireEvent.pointerDown(handle, {
      pointerId: 1,
      button: 0,
      clientX: 280,
      clientY: 170,
    });
    fireEvent.pointerMove(list, { pointerId: 1, clientX: 280, clientY: 112 });

    expect(list.querySelectorAll("[data-sort-item]")).toHaveLength(2);
    expect(list.querySelectorAll("[data-drop-placeholder]")).toHaveLength(1);
    expect(gameSelectionOrderSetting.getSnapshot()).toEqual([]);

    fireEvent.pointerUp(list, { pointerId: 1, clientX: 280, clientY: 112 });

    const names = within(list)
      .getAllByRole("listitem")
      .map((item) => item.textContent?.trim());
    expect(names).toEqual(["ナンプレ", "ウォーターソート"]);
    expect(gameSelectionOrderSetting.getSnapshot()).toEqual([
      "nanpure",
      "water-sort",
    ]);
    bounds.mockRestore();
    rowHeights.mockRestore();
    rowPositions.mockRestore();
  });

  test("ドラッグをキャンセルしても並び順を保存しないこと", () => {
    const list = screen.getByRole("list", { name: "パズルの並び順" });
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "ナンプレを並び替え" }),
      { pointerId: 2, button: 0, clientX: 280, clientY: 170 },
    );
    fireEvent.pointerCancel(list, { pointerId: 2 });

    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(gameSelectionOrderSetting.getSnapshot()).toEqual([]);
  });

  test("初期順に戻してから設定画面に戻れること", () => {
    const dialog = within(
      screen.getByRole("dialog", { name: "パズルの並び順" }),
    );
    fireEvent.keyDown(
      dialog.getByRole("button", { name: "ナンプレを並び替え" }),
      { key: "ArrowUp" },
    );
    fireEvent.click(dialog.getByRole("button", { name: "初期順に戻す" }));
    fireEvent.click(dialog.getByRole("button", { name: "設定に戻る" }));

    expect(gameSelectionOrderSetting.getSnapshot()).toEqual([]);
    expect(screen.getByRole("dialog", { name: "設定" })).toBeTruthy();
  });
});

describe("設定一覧", () => {
  beforeEach(() => {
    render(
      <GameCatalogProvider
        games={[
          { id: "water-sort", name: "ウォーターソート" },
          { id: "nanpure", name: "ナンプレ" },
        ]}
      >
        <SettingsDialog open onOpenChange={vi.fn()} />
      </GameCatalogProvider>,
    );
  });

  test("並び順・ランダム出題・サウンドの順に、現在値とともに表示すること", () => {
    const navigation = screen.getByRole("navigation", { name: "設定項目" });
    const items = within(navigation).getAllByRole("button");
    const contents = items.map((item) => item.textContent);

    expect(contents).toEqual([
      "パズルの並び順初期順",
      "ランダム出題出題対象 6/6",
      "サウンド効果音 5 · BGM 5",
    ]);
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  test("並び順を変更すると設定一覧の要約に反映すること", () => {
    fireEvent.click(screen.getByRole("button", { name: /パズルの並び順/ }));
    fireEvent.keyDown(
      screen.getByRole("button", { name: "ナンプレを並び替え" }),
      { key: "ArrowUp" },
    );
    fireEvent.click(screen.getByRole("button", { name: "設定に戻る" }));

    expect(screen.getByRole("dialog", { name: "設定" })).toBeTruthy();
    expect(screen.getByText("並び替え済み")).toBeTruthy();
    expect(gameSelectionOrderSetting.getSnapshot()[0]).toBe("nanpure");
  });

  test("ランダム出題の条件を変更すると設定一覧の要約に反映すること", () => {
    fireEvent.click(screen.getByRole("button", { name: /ランダム出題/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /perfect/ }));
    fireEvent.click(screen.getByRole("button", { name: "設定に戻る" }));

    expect(screen.getByText("出題対象 5/6")).toBeTruthy();
    expect(randomProblemSettings.getSnapshot().global).not.toContain("perfect");
  });

  test("サウンドの消音を変更すると設定一覧の要約に反映すること", () => {
    fireEvent.click(screen.getByRole("button", { name: /サウンド/ }));
    fireEvent.click(screen.getByRole("button", { name: "BGMを消音" }));
    fireEvent.click(screen.getByRole("button", { name: "設定に戻る" }));

    expect(screen.getByText("効果音 5 · BGM オフ")).toBeTruthy();
    expect(backgroundMusicVolumeSetting.getVolume()).toBe(0);
  });
});

describe("複数のパズルのドラッグ操作", () => {
  let list: HTMLElement;

  beforeEach(() => {
    render(
      <GameCatalogProvider
        games={[
          { id: "water-sort", name: "ウォーターソート" },
          { id: "nanpure", name: "ナンプレ" },
          { id: "minesweeper", name: "マインスイーパー" },
          { id: "slide-puzzle", name: "スライドパズル" },
        ]}
      >
        <SettingsDialog open onOpenChange={vi.fn()} />
      </GameCatalogProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /パズルの並び順/ }));
    list = screen.getByRole("list", { name: "パズルの並び順" });
    vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(
      function (this: HTMLElement) {
        return Array.from(list.children).indexOf(this) * 48;
      },
    );
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(48);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const index = Array.from(list.children).indexOf(this);
        const top = this === list ? 100 : 100 + index * 48 - list.scrollTop;
        return {
          x: 0,
          y: top,
          top,
          left: 0,
          width: 320,
          height: this === list ? 192 : 48,
          right: 320,
          bottom: top + (this === list ? 192 : 48),
          toJSON() {},
        };
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLElement.prototype, "animate");
  });

  test("複数のパズルを飛び越えて下へ移動し、順序を保存すること", () => {
    const handle = screen.getByRole("button", { name: "ナンプレを並び替え" });
    fireEvent.pointerDown(handle, {
      pointerId: 1,
      button: 0,
      clientX: 280,
      clientY: 172,
    });
    fireEvent.pointerMove(list, { pointerId: 1, clientX: 280, clientY: 280 });
    const placeholder = list.querySelector("[data-drop-placeholder]");
    const moving = gameSelectionOrderSetting.getSnapshot();
    fireEvent.pointerUp(list, { pointerId: 1, clientX: 280, clientY: 280 });
    const result = Array.from(
      list.querySelectorAll<HTMLElement>("[data-sort-item]"),
      (row) => row.dataset.sortItem,
    );

    expect(placeholder?.getAttribute("data-sort-item")).toBe("nanpure");
    expect(moving).toEqual([]);
    expect(result).toEqual([
      "water-sort",
      "minesweeper",
      "slide-puzzle",
      "nanpure",
    ]);
    expect(gameSelectionOrderSetting.getSnapshot()).toEqual(result);
  });

  test("スクロール中も行の論理位置から移動先を判定すること", () => {
    const handle = screen.getByRole("button", { name: "ナンプレを並び替え" });
    fireEvent.pointerDown(handle, {
      pointerId: 2,
      button: 0,
      clientX: 280,
      clientY: 172,
    });
    list.scrollTop = 96;
    fireEvent.pointerMove(list, { pointerId: 2, clientX: 280, clientY: 125 });
    fireEvent.pointerUp(list, { pointerId: 2, clientX: 280, clientY: 125 });
    const result = gameSelectionOrderSetting.getSnapshot();

    expect(result).toEqual([
      "water-sort",
      "minesweeper",
      "nanpure",
      "slide-puzzle",
    ]);
  });

  test("違うポインターの操作を無視し、ドラッグのキャンセルで保存しないこと", () => {
    const handle = screen.getByRole("button", { name: "ナンプレを並び替え" });
    fireEvent.pointerDown(handle, {
      pointerId: 3,
      button: 0,
      clientX: 280,
      clientY: 172,
    });
    fireEvent.pointerUp(list, { pointerId: 9, clientX: 280, clientY: 280 });
    const duringDrag = list.querySelector("[data-drop-placeholder]");
    fireEvent.pointerCancel(list, { pointerId: 3 });
    const afterCancel = list.querySelector("[data-drop-placeholder]");

    expect(duringDrag).not.toBeNull();
    expect(afterCancel).toBeNull();
    expect(gameSelectionOrderSetting.getSnapshot()).toEqual([]);
  });

  test("ドロップ後のアニメーション完了で移動中の重ね表示を解除すること", async () => {
    const finishAnimations: Array<() => void> = [];
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: vi.fn(() => ({
        finished: new Promise<void>((resolve) =>
          finishAnimations.push(resolve),
        ),
        cancel: vi.fn(),
      })),
    });
    const handle = screen.getByRole("button", { name: "ナンプレを並び替え" });
    fireEvent.pointerDown(handle, {
      pointerId: 4,
      button: 0,
      clientX: 280,
      clientY: 172,
    });
    fireEvent.pointerUp(list, { pointerId: 4, clientX: 280, clientY: 280 });
    const duringSettle = document.body.querySelector(
      "[aria-hidden='true'].pointer-events-none.fixed",
    );
    await act(async () => {
      for (const finish of finishAnimations) finish();
    });
    const afterSettle = document.body.querySelector(
      "[aria-hidden='true'].pointer-events-none.fixed",
    );

    expect(duringSettle).not.toBeNull();
    expect(afterSettle).toBeNull();
  });
});
