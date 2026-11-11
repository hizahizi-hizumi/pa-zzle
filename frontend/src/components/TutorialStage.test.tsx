import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { useTutorialMusicState } from "@/components/app-background-music";
import type { TutorialFinish } from "@/components/TutorialOverlay";
import {
  TutorialStage,
  type TutorialStageBoardIntro,
} from "@/components/TutorialStage";
import type { TutorialMessage, TutorialPhase } from "@/games/tutorial";

vi.mock("@/components/app-background-music", () => ({
  useTutorialMusicState: vi.fn(),
}));

const intro = {
  purpose: "テスト用のパズル",
  goalCaption: "この形がゴール",
};

const recap = ["1つ目のルール", "2つ目のルール"];

const defaultMessage: TutorialMessage = {
  headline: "最初の一言",
  detail: "補う一文",
};

afterEach(cleanup);

function getScreen(): HTMLElement {
  return screen.getByRole("dialog", { name: "テストパズル" });
}

describe("TutorialStage", () => {
  let onIntroEnd: ReturnType<typeof vi.fn<() => void>>;
  let onRestart: ReturnType<typeof vi.fn<() => void>>;
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  // 盤面に渡された入口の場面。盤面の代わりに場面の終わりを伝える。
  let boardIntro: TutorialStageBoardIntro | undefined;

  beforeEach(() => {
    vi.mocked(useTutorialMusicState).mockClear();
    onIntroEnd = vi.fn<() => void>();
    onRestart = vi.fn<() => void>();
    onClose = vi.fn<() => void>();
    boardIntro = undefined;
  });

  function renderStage({
    open = true,
    phase = "intro",
    progress = 0,
    finish = { entry: "play", onReturnToPlay: vi.fn() },
  }: {
    open?: boolean;
    phase?: TutorialPhase;
    progress?: number;
    finish?: TutorialFinish;
  } = {}): void {
    render(
      <TutorialStage
        open={open}
        title="テストパズル"
        pictogramSvg="<svg></svg>"
        background={<div />}
        intro={intro}
        recap={recap}
        message={defaultMessage}
        phase={phase}
        progress={progress}
        progressStepCount={6}
        finish={finish}
        renderBoard={(currentIntro) => {
          boardIntro = currentIntro;
          return <div role="group" aria-label="盤面" />;
        }}
        onIntroEnd={onIntroEnd}
        onRestart={onRestart}
        onClose={onClose}
      />,
    );
  }

  describe("入口を見せる場合", () => {
    beforeEach(() => {
      renderStage();
    });

    test("ゴールの盤面に、何をするパズルかとゴールの一言を添え、はじめるだけを出すこと", () => {
      const purpose = within(getScreen()).queryByText(intro.purpose);
      const caption = within(getScreen()).queryByText(intro.goalCaption);
      const message = within(getScreen()).queryByText(defaultMessage.headline);
      const buttons = within(getScreen())
        .getAllByRole("button")
        .map(
          (button) => button.textContent || button.getAttribute("aria-label"),
        );

      expect(purpose).not.toBeNull();
      expect(caption).not.toBeNull();
      expect(message).toBeNull();
      expect(boardIntro?.scene).toBe("goal");
      expect(boardIntro?.playing).toBe(false);
      expect(buttons).toEqual(["閉じる", "はじめる"]);
    });

    test("はじめるを押すと、入口を終えたと知らせ、始めの盤面へ替える動きを盤面に任せて一言を出すこと", () => {
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "はじめる" }),
      );

      const message = within(getScreen()).queryByText(defaultMessage.headline);
      const startButton = within(getScreen()).queryByRole("button", {
        name: "はじめる",
      });

      expect(onIntroEnd).toHaveBeenCalledOnce();
      expect(boardIntro?.scene).toBe("start");
      expect(boardIntro?.playing).toBe(true);
      expect(message).not.toBeNull();
      expect(startButton).toBeNull();
    });

    test("始めの盤面へ替える動きを終えると、盤面に解いている盤面を見せさせること", () => {
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "はじめる" }),
      );
      act(() => boardIntro?.onSceneEnd());

      const scene = boardIntro?.scene;

      expect(scene).toBeNull();
      expect(boardIntro?.playing).toBe(false);
    });
  });

  describe("盤面を解いている場合", () => {
    beforeEach(() => {
      renderStage({ phase: "playing", progress: 0.5 });
    });

    test("達成を返す輪を出さないこと", () => {
      const celebration = getScreen().querySelector(
        "[data-tutorial-celebration]",
      );

      expect(celebration).toBeNull();
    });

    test("入口を見せず、一言の見出しと補う一文を出すこと", () => {
      const headline = within(getScreen()).queryByText(defaultMessage.headline);
      const detail = within(getScreen()).queryByText(
        defaultMessage.detail ?? "",
      );
      const startButton = within(getScreen()).queryByRole("button", {
        name: "はじめる",
      });

      expect(boardIntro?.scene).toBeNull();
      expect(headline).not.toBeNull();
      expect(detail).not.toBeNull();
      expect(startButton).toBeNull();
    });

    test("進み具合を百分率で示すこと", () => {
      const progressbar = within(getScreen()).getByRole("progressbar", {
        name: "チュートリアルの進み具合",
      });

      const value = progressbar.getAttribute("aria-valuenow");

      expect(value).toBe("50");
    });

    test("画面を覆わず、終えたときの操作を出さないこと", () => {
      const scrim = document.querySelector("[data-tutorial-focus-scrim]");
      const restartButton = within(getScreen()).queryByRole("button", {
        name: "もう一度",
      });

      expect(scrim).toBeNull();
      expect(restartButton).toBeNull();
    });

    test("閉じるを押すと、閉じる操作を知らせること", () => {
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "閉じる" }),
      );

      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe("ゲームのホームから開いて解き終えた場合", () => {
    let onStartPlay: ReturnType<typeof vi.fn<() => void>>;

    beforeEach(() => {
      onStartPlay = vi.fn<() => void>();
      renderStage({
        phase: "completed",
        progress: 1,
        finish: { entry: "home", difficulty: "4", onStartPlay },
      });
    });

    test("完成の一言の後ろに、達成を返す輪を出すこと", () => {
      const celebration = getScreen().querySelector(
        "[data-tutorial-celebration]",
      );

      expect(celebration).not.toBeNull();
    });

    test("覚えたルールを並べること", () => {
      const items = within(
        within(getScreen()).getByRole("list", { name: "覚えたルール" }),
      )
        .getAllByRole("listitem")
        .map((item) => item.textContent);

      expect(items).toEqual(recap);
    });

    test("ゲームのホームで開いているレベルを遊ぶ操作を出し、押すとそのプレイを始めること", () => {
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "レベル 4を遊ぶ" }),
      );

      expect(onStartPlay).toHaveBeenCalledOnce();
    });
  });

  describe("プレイ中のメニューから開いて解き終えた場合", () => {
    let onReturnToPlay: ReturnType<typeof vi.fn<() => void>>;

    beforeEach(() => {
      onReturnToPlay = vi.fn<() => void>();
      renderStage({
        phase: "completed",
        progress: 1,
        finish: { entry: "play", onReturnToPlay },
      });
    });

    test("プレイに戻る操作を出し、押すとプレイへ戻ること", () => {
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "プレイに戻る" }),
      );

      expect(onReturnToPlay).toHaveBeenCalledOnce();
    });

    test("もう一度を押すと、入口を見せずに、もう一度始める操作を知らせること", () => {
      fireEvent.click(
        within(getScreen()).getByRole("button", { name: "もう一度" }),
      );

      const startButton = within(getScreen()).queryByRole("button", {
        name: "はじめる",
      });

      expect(onRestart).toHaveBeenCalledOnce();
      expect(startButton).toBeNull();
      expect(boardIntro?.scene).toBeNull();
    });
  });

  describe("BGM の場面", () => {
    const cases = [
      ["閉じている", false, "playing", "closed"],
      ["入口を見せている", true, "intro", "solving"],
      ["盤面を解いている", true, "playing", "solving"],
      ["解き終えて完成演出を見せている", true, "solved", "solved"],
      ["終えたときの操作を待っている", true, "completed", "solved"],
    ] as const;

    test.each(cases)(
      "%s間は、%s の段で %s を知らせること",
      (_, open, phase, expected) => {
        renderStage({ open, phase });

        const state = vi.mocked(useTutorialMusicState).mock.lastCall?.[0];

        expect(state).toBe(expected);
      },
    );
  });
});
