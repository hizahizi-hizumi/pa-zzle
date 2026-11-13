import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { AppTitleScreen } from "@/components/AppTitleScreen";
import type { AppLaunchTitle } from "@/lib/app-launch";
import { isSoundEffectsEnabled } from "@/lib/sound-effects-setting";

const { playGameSelectSound, playSoundEffectsVolumePreview } = vi.hoisted(
  () => ({
    playGameSelectSound: vi.fn(),
    playSoundEffectsVolumePreview: vi.fn(),
  }),
);

vi.mock("@/components/app-decision-sound", () => ({
  playGameSelectSound,
  playSoundEffectsVolumePreview,
}));

const games = [
  {
    name: "ウォーターソート",
    pictogramSvg: "<svg />",
    to: "/puzzles/water-sort",
  },
  { name: "ナンプレ", pictogramSvg: "<svg />", to: "/puzzles/nanpure" },
] as const;

let onEnter: ReturnType<typeof vi.fn<() => void>>;

function renderTitle(title: AppLaunchTitle) {
  onEnter = vi.fn<() => void>();
  render(
    <MemoryRouter>
      <AppTitleScreen title={title} games={games} onEnter={onEnter} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  playGameSelectSound.mockClear();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("AppTitleScreen", () => {
  describe("効果音を読み込んでいる場合", () => {
    beforeEach(() => {
      renderTitle({ status: "loading", progressRatio: 0.4 });
    });

    test("読み込みの進みを見せ、はじめる操作を出さず、ゲームへの入口を押せなくすること", () => {
      const title = screen.getByRole("dialog", { name: "pa-zzle" });
      const progress = within(title).getByRole("progressbar", {
        name: "効果音の読み込み",
      });

      expect(progress).toBeTruthy();
      expect(within(title).queryByText("タップしてはじめる")).toBeNull();
      expect(
        within(title)
          .getAllByRole("link")
          .every((link) => link.hasAttribute("inert")),
      ).toBe(true);
    });

    test("画面を押しても入らないこと", () => {
      fireEvent.click(screen.getByRole("dialog"));

      expect(onEnter).not.toHaveBeenCalled();
    });

    test("Escape でも入らないこと", () => {
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

      expect(onEnter).not.toHaveBeenCalled();
    });

    test("Enter でも入らないこと", () => {
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });

      expect(onEnter).not.toHaveBeenCalled();
    });
  });

  describe("入れる場合", () => {
    beforeEach(() => {
      renderTitle({ status: "ready" });
    });

    test("はじめる操作をボタンとして出し、読み込みの進みを出さないこと", () => {
      const title = screen.getByRole("dialog", { name: "pa-zzle" });
      const start = within(title).getByText("タップしてはじめる");

      expect(start.tagName).toBe("BUTTON");
      expect(within(title).queryByRole("progressbar")).toBeNull();
    });

    test("はじめる操作で、効果音を鳴らさずに一度だけ入ること", () => {
      fireEvent.click(screen.getByText("タップしてはじめる"));

      expect(onEnter).toHaveBeenCalledOnce();
      expect(playGameSelectSound).not.toHaveBeenCalled();
    });

    test("画面のどこを押しても入ること", () => {
      fireEvent.click(screen.getByRole("dialog"));

      expect(onEnter).toHaveBeenCalledOnce();
    });

    test("Escape で入ること", () => {
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

      expect(onEnter).toHaveBeenCalledOnce();
    });

    test("画面を選んだまま Enter を押すと入ること", () => {
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });

      expect(onEnter).toHaveBeenCalledOnce();
    });

    describe("設定を開いた場合", () => {
      beforeEach(() => {
        // 音量のスライダーが大きさを測るので、jsdom に無い ResizeObserver を置く。
        vi.stubGlobal(
          "ResizeObserver",
          class {
            observe() {}
            unobserve() {}
            disconnect() {}
          },
        );
        fireEvent.click(screen.getByRole("button", { name: "設定" }));
      });

      test("入らずに、効果音と BGM の音量を選ぶ設定のダイアログを開くこと", () => {
        const settings = screen.getByRole("dialog", { name: "設定" });

        expect(onEnter).not.toHaveBeenCalled();
        fireEvent.click(
          within(settings).getByRole("button", { name: /サウンド/ }),
        );
        const sound = screen.getByRole("dialog", { name: "サウンド" });
        expect(
          within(sound).getByRole("group", { name: "効果音" }),
        ).toBeTruthy();
        expect(within(sound).getByRole("group", { name: "BGM" })).toBeTruthy();
        fireEvent.click(
          within(sound).getByRole("button", { name: "設定に戻る" }),
        );
        fireEvent.click(screen.getByRole("button", { name: /ランダム出題/ }));
        expect(
          within(
            screen.getByRole("dialog", { name: "ランダム出題" }),
          ).getByRole("group", { name: "出題対象" }),
        ).toBeTruthy();
      });

      test("設定のダイアログの中の操作では入らず、設定を変えること", () => {
        const settings = screen.getByRole("dialog", { name: "設定" });
        fireEvent.click(
          within(settings).getByRole("button", { name: /サウンド/ }),
        );
        fireEvent.click(screen.getByRole("button", { name: "効果音を消音" }));
        const enabled = isSoundEffectsEnabled();

        expect(onEnter).not.toHaveBeenCalled();
        expect(enabled).toBe(false);
      });

      test("設定を閉じると、入らずにタイトルへ戻ること", () => {
        const settings = screen.getByRole("dialog", { name: "設定" });
        fireEvent.click(
          within(settings).getByRole("button", { name: "閉じる" }),
        );

        expect(onEnter).not.toHaveBeenCalled();
        expect(screen.queryByRole("dialog", { name: "設定" })).toBeNull();
        expect(screen.getByRole("button", { name: "設定" })).toBeTruthy();
      });
    });

    test("ゲームのピクトグラムをそのゲームのホームへの入口にすること", () => {
      const links = within(screen.getByRole("list")).getAllByRole("link");
      const inertLinks = links.filter((link) => link.hasAttribute("inert"));

      expect(links.map((link) => link.getAttribute("href"))).toEqual(
        games.map(({ to }) => to),
      );
      expect(links.map((link) => link.getAttribute("aria-label"))).toEqual(
        games.map(({ name }) => `${name}を遊ぶ`),
      );
      expect(inertLinks).toEqual([]);
    });

    test("ピクトグラムで、ゲームを選んだ音を鳴らして一度だけ入ること", () => {
      fireEvent.click(screen.getByRole("link", { name: "ナンプレを遊ぶ" }));

      expect(onEnter).toHaveBeenCalledOnce();
      expect(playGameSelectSound).toHaveBeenCalledOnce();
    });
  });

  describe("出さない場合", () => {
    beforeEach(() => {
      renderTitle({ status: "hidden" });
    });

    test("何も出さないこと", () => {
      const title = screen.queryByRole("dialog");

      expect(title).toBeNull();
    });
  });
});
