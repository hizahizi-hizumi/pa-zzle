import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";

import { useTutorialMusicState } from "@/components/app-background-music";
import { TutorialCue } from "@/components/TutorialCue";
import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
  type TutorialRuleListItem,
} from "@/components/TutorialOverlay";
import {
  TUTORIAL_SPOTLIGHT_ATTRIBUTE,
  TutorialSpotlight,
} from "@/components/TutorialSpotlight";
import type { TutorialMessage, TutorialPhase } from "@/games/tutorial";

vi.mock("@/components/app-background-music", () => ({
  useTutorialMusicState: vi.fn(),
}));

/** 盤面は場面の動きを終えないので、導入は「次へ」を押したときだけ進む。 */
const intro = {
  purpose: "テスト用のパズルです",
  goalCaption: "この形がゴールです",
  startCaption: "最初はこの形です",
};

/** 名前を上部へ戻してから、最初の手順を始めるまでに十分な間。 */
const introFinishEnoughMs = 1000;

/** 盤面を読むのに十分すぎる間。導入はこれだけ待っても自動では進まない。 */
const longWaitMs = 60_000;

/** 名前を上部へ戻し始めてから、ルールと一言を出し始めるまでの間。 */
const revealAfterNameDelayMs = 350;

afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { animate?: Element["animate"] }).animate;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function installAnimate(): void {
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: vi.fn(
      () =>
        ({
          cancel: vi.fn(),
          finished: Promise.resolve(),
        }) as unknown as Animation,
    ),
  });
}

function stubReducedMotion(): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true }) as MediaQueryList),
  );
}

function advanceTime(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function pressNext(): void {
  fireEvent.pointerDown(screen.getByRole("button", { name: "次へ" }));
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
}

const defaultRules: readonly TutorialRuleListItem[] = [
  { id: "rule", label: "ルール", earned: false, current: false },
];

const defaultMessage: TutorialMessage = {
  headline: "最初の一言",
  detail: null,
};

describe("TutorialOverlay", () => {
  let onIntroEnd: ReturnType<typeof vi.fn<() => void>>;
  let onRestart: ReturnType<typeof vi.fn<() => void>>;
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  // 盤面に渡された導入の場面。盤面の代わりに場面の終わりを伝える。
  let boardIntro: TutorialBoardIntro | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(useTutorialMusicState).mockClear();
    onIntroEnd = vi.fn<() => void>();
    onRestart = vi.fn<() => void>();
    onClose = vi.fn<() => void>();
  });

  function renderOverlay({
    open = true,
    phase = "intro",
    guiding = false,
    finish = { entry: "play", onReturnToPlay: vi.fn() },
    rules = defaultRules,
    message = defaultMessage,
    renderBoard = () => <div role="group" aria-label="盤面" />,
  }: {
    open?: boolean;
    phase?: TutorialPhase;
    guiding?: boolean;
    finish?: TutorialFinish;
    rules?: readonly TutorialRuleListItem[];
    message?: TutorialMessage;
    renderBoard?: (intro: TutorialBoardIntro) => ReactNode;
  } = {}): void {
    render(
      <TutorialOverlay
        open={open}
        title="テストパズル"
        pictogramSvg="<svg></svg>"
        intro={intro}
        rules={rules}
        message={message}
        phase={phase}
        guiding={guiding}
        finish={finish}
        renderBoard={(currentIntro) => {
          boardIntro = currentIntro;
          return renderBoard(currentIntro);
        }}
        onIntroEnd={onIntroEnd}
        onRestart={onRestart}
        onClose={onClose}
      />,
    );
  }

  describe("動きで導入を見せる場合", () => {
    beforeEach(() => {
      installAnimate();
      renderOverlay();
    });

    test("次へを押すたびに、待たずにゴールの盤面、始まりの盤面へ進むこと", () => {
      pressNext();
      const goalCaption = screen.queryByText(intro.goalCaption);
      pressNext();

      const startCaption = screen.queryByText(intro.startCaption);

      expect(goalCaption).not.toBeNull();
      expect(startCaption).not.toBeNull();
      expect(onIntroEnd).not.toHaveBeenCalled();
    });

    test("始まりの盤面で次へを押すと、導入を終えて次へを下げること", () => {
      pressNext();
      pressNext();
      pressNext();
      advanceTime(introFinishEnoughMs);

      const nextButton = screen.queryByRole("button", { name: "次へ" });

      expect(onIntroEnd).toHaveBeenCalledOnce();
      expect(nextButton).toBeNull();
    });

    test("名前を上部へ戻すときは、ルールと一言を出し始めてから、出したことを盤面へ伝えること", () => {
      pressNext();
      pressNext();
      pressNext();
      const beforeReveal = boardIntro?.messageShown;
      advanceTime(revealAfterNameDelayMs);

      const revealed = boardIntro?.messageShown;

      expect(beforeReveal).toBe(false);
      expect(revealed).toBe(true);
      expect(onIntroEnd).not.toHaveBeenCalled();
    });

    describe("ゴールの場面の動きを終えた場合", () => {
      beforeEach(() => {
        pressNext();
        act(() => boardIntro?.onSceneEnd());
      });

      test("待っても始まりの盤面へ進まず、ゴールの盤面を止めて見せ続けること", () => {
        advanceTime(longWaitMs);

        const goalCaption = screen.queryByText(intro.goalCaption);
        const startCaption = screen.queryByText(intro.startCaption);

        expect(goalCaption).not.toBeNull();
        expect(startCaption).toBeNull();
        expect(boardIntro?.playing).toBe(false);
      });
    });

    test("次へでEnterを押しても、導入を終えないこと", () => {
      fireEvent.keyDown(screen.getByRole("button", { name: "次へ" }), {
        key: "Enter",
      });

      expect(onIntroEnd).not.toHaveBeenCalled();
    });

    const finishMotionCases = [
      [
        "盤面を押す",
        () =>
          fireEvent.pointerDown(screen.getByRole("group", { name: "盤面" })),
      ],
      [
        "キーを押す",
        () =>
          fireEvent.keyDown(screen.getByRole("group", { name: "盤面" }), {
            key: "a",
          }),
      ],
    ] as const;

    test.each(finishMotionCases)(
      "名前を見せている間に%sと、ゴールの盤面を動きを終えた姿で見せ、次へを待つこと",
      (_, finishMotion) => {
        finishMotion();
        advanceTime(longWaitMs);

        const goalCaption = screen.queryByText(intro.goalCaption);
        const nextButton = screen.queryByRole("button", { name: "次へ" });

        expect(goalCaption).not.toBeNull();
        expect(boardIntro?.scene).toBe("goal");
        expect(boardIntro?.playing).toBe(false);
        expect(nextButton).not.toBeNull();
        expect(onIntroEnd).not.toHaveBeenCalled();
      },
    );

    test.each(finishMotionCases)(
      "始めの盤面へ移る間に%sと、始めの盤面を動きを終えた姿で見せ、次へを待つこと",
      (_, finishMotion) => {
        pressNext();
        pressNext();
        finishMotion();

        const startCaption = screen.queryByText(intro.startCaption);

        expect(startCaption).not.toBeNull();
        expect(boardIntro?.scene).toBe("start");
        expect(boardIntro?.playing).toBe(false);
        expect(onIntroEnd).not.toHaveBeenCalled();
      },
    );

    test.each(finishMotionCases)(
      "ゴールの盤面を見せ終えた後に%sと、始まりの盤面へ進まずにゴールの盤面を見せ続けること",
      (_, finishMotion) => {
        pressNext();
        act(() => boardIntro?.onSceneEnd());
        finishMotion();

        const goalCaption = screen.queryByText(intro.goalCaption);
        const startCaption = screen.queryByText(intro.startCaption);

        expect(goalCaption).not.toBeNull();
        expect(startCaption).toBeNull();
        expect(onIntroEnd).not.toHaveBeenCalled();
      },
    );

    test.each(finishMotionCases)(
      "始まりの盤面の後、名前を上部へ戻す間に%sと、待たずに導入を終えること",
      (_, finishMotion) => {
        pressNext();
        pressNext();
        pressNext();
        finishMotion();

        const nextButton = screen.queryByRole("button", { name: "次へ" });

        expect(onIntroEnd).toHaveBeenCalledOnce();
        expect(nextButton).toBeNull();
      },
    );
  });

  describe("動きを減らす設定の場合", () => {
    beforeEach(() => {
      installAnimate();
      stubReducedMotion();
      renderOverlay();
    });

    test("ゴールの盤面で次へを押すと、待たずに始まりの盤面へ進み、もう一度押すと導入を終えること", () => {
      pressNext();
      const startCaption = screen.queryByText(intro.startCaption);
      pressNext();

      const nextButton = screen.queryByRole("button", { name: "次へ" });

      expect(startCaption).not.toBeNull();
      expect(onIntroEnd).toHaveBeenCalledOnce();
      expect(nextButton).toBeNull();
    });
  });

  describe("ゲームのホームから開いて解き終えた場合", () => {
    let onStartPlay: ReturnType<typeof vi.fn<() => void>>;

    beforeEach(() => {
      onStartPlay = vi.fn<() => void>();
      renderOverlay({
        phase: "completed",
        finish: { entry: "home", difficulty: "4", onStartPlay },
      });
    });

    test("ゲームのホームで開いているレベルを遊ぶ操作を出し、押すとそのプレイを始めること", () => {
      fireEvent.click(screen.getByRole("button", { name: "レベル 4を遊ぶ" }));

      expect(onStartPlay).toHaveBeenCalledOnce();
    });
  });

  describe("画面全体の覆い", () => {
    function getScrim(): Element | null {
      return document.querySelector("[data-tutorial-focus-scrim]");
    }

    describe("手を引いている場合", () => {
      beforeEach(() => {
        renderOverlay({ phase: "playing", guiding: true });
      });

      test("画面全体に覆いを重ね、一言の面を覆いから抜くこと", () => {
        const scrim = getScrim();
        const spotlit = screen
          .getByText("最初の一言")
          .closest("[data-tutorial-spotlight]");

        expect(scrim).not.toBeNull();
        expect(spotlit).not.toBeNull();
      });
    });

    describe("手を離した場合", () => {
      beforeEach(() => {
        renderOverlay({ phase: "playing", guiding: false });
      });

      test("覆いを重ねないこと", () => {
        const scrim = getScrim();

        expect(scrim).toBeNull();
      });
    });

    describe("導入を見せている場合", () => {
      beforeEach(() => {
        installAnimate();
        renderOverlay({ phase: "intro", guiding: true });
      });

      test("手を引く手順があっても、覆いを重ねないこと", () => {
        const scrim = getScrim();

        expect(scrim).toBeNull();
      });
    });
  });
  describe("BGM の場面", () => {
    const cases = [
      ["閉じている", false, "playing", "closed"],
      ["導入を見せている", true, "intro", "solving"],
      ["盤面を解いている", true, "playing", "solving"],
      ["解き終えて完成演出を見せている", true, "solved", "solved"],
      ["終えたときの操作を待っている", true, "completed", "solved"],
    ] as const;

    test.each(cases)(
      "%s間は、%s の段で %s を知らせること",
      (_, open, phase, expected) => {
        renderOverlay({ open, phase });

        const state = vi.mocked(useTutorialMusicState).mock.lastCall?.[0];

        expect(state).toBe(expected);
      },
    );
  });

  describe("盤面を解いている場合", () => {
    beforeEach(() => {
      renderOverlay({
        phase: "playing",
        rules: [
          { id: "first", label: "1つ目のルール", earned: true, current: false },
          { id: "second", label: "2つ目のルール", earned: true, current: true },
          {
            id: "third",
            label: "3つ目のルール",
            earned: false,
            current: false,
          },
        ],
        message: { headline: "見出しの一言", detail: "補う一文" },
      });
    });

    test("手に入れたルールを並べ、まだ出ていないルールは中身を伏せること", () => {
      const ruleList = screen.getByRole("list", { name: "ルール" });

      const items = within(ruleList)
        .getAllByRole("listitem")
        .map((item) => item.textContent);

      expect(items).toEqual([
        "1つ目のルール",
        "2つ目のルール",
        "まだ出ていないルール",
      ]);
    });

    test("今の手順で示しているルールを、今のルールとして示すこと", () => {
      const ruleList = screen.getByRole("list", { name: "ルール" });

      const current = ruleList.querySelector("[aria-current='step']");

      expect(current?.textContent).toBe("2つ目のルール");
    });

    test("一言の見出しと補う一文を出すこと", () => {
      const headline = screen.queryByText("見出しの一言");
      const detail = screen.queryByText("補う一文");

      expect(headline).not.toBeNull();
      expect(detail).not.toBeNull();
    });

    test("導入の次へも、終えたときの操作も出さないこと", () => {
      const nextButton = screen.queryByRole("button", { name: "次へ" });
      const restartButton = screen.queryByRole("button", { name: "もう一度" });

      expect(nextButton).toBeNull();
      expect(restartButton).toBeNull();
    });

    test("閉じるを押すと、閉じる操作を知らせること", () => {
      fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe("プレイ中のメニューから開いて解き終えた場合", () => {
    let onReturnToPlay: ReturnType<typeof vi.fn<() => void>>;

    beforeEach(() => {
      onReturnToPlay = vi.fn<() => void>();
      renderOverlay({
        phase: "completed",
        finish: { entry: "play", onReturnToPlay },
      });
    });

    test("プレイに戻る操作を出し、押すとプレイへ戻ること", () => {
      fireEvent.click(screen.getByRole("button", { name: "プレイに戻る" }));

      expect(onReturnToPlay).toHaveBeenCalledOnce();
    });

    test("もう一度を押すと、進行を始めからにし、始まりの盤面から導入を見せ直すこと", () => {
      fireEvent.click(screen.getByRole("button", { name: "もう一度" }));

      const startCaption = screen.queryByText(intro.startCaption);
      const nextButton = screen.queryByRole("button", { name: "次へ" });

      expect(onRestart).toHaveBeenCalledOnce();
      expect(startCaption).not.toBeNull();
      expect(boardIntro?.scene).toBe("start");
      expect(nextButton).not.toBeNull();
    });
  });

  describe("盤面部品に印と覆いから抜く所を置いて手を引く場合", () => {
    beforeEach(() => {
      renderOverlay({
        phase: "playing",
        guiding: true,
        renderBoard: () => (
          <div role="group" aria-label="盤面">
            <button type="button" className="relative rounded-md">
              次に押すマス
              <TutorialSpotlight active={true} className="inset-0 rounded-md" />
              <TutorialCue kind="mark" recallId={null} />
            </button>
            <button type="button" className="relative rounded-md">
              ほかのマス
              <TutorialSpotlight
                active={false}
                className="inset-0 rounded-md"
              />
            </button>
          </div>
        ),
      });
    });

    test("次に押すマスだけに印と抜く所を置き、画面全体に覆いを重ねること", () => {
      const board = screen.getByRole("group", { name: "盤面" });
      const nextCell = within(board).getByText("次に押すマス");
      const otherCell = within(board).getByText("ほかのマス");

      const scrim = document.querySelector("[data-tutorial-focus-scrim]");

      expect(scrim).not.toBeNull();
      expect(
        nextCell.querySelector(`[${TUTORIAL_SPOTLIGHT_ATTRIBUTE}]`),
      ).not.toBeNull();
      expect(
        nextCell.querySelector("[data-tutorial-cue='mark']"),
      ).not.toBeNull();
      expect(
        otherCell.querySelector(`[${TUTORIAL_SPOTLIGHT_ATTRIBUTE}]`),
      ).toBeNull();
    });
  });
});
