import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import {
  type TutorialBoardIntro,
  type TutorialFinish,
  TutorialOverlay,
} from "@/components/TutorialOverlay";
import type { TutorialPhase } from "@/games/tutorial";

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

describe("TutorialOverlay", () => {
  let onIntroEnd: ReturnType<typeof vi.fn<() => void>>;
  // 盤面に渡された導入の場面。盤面の代わりに場面の終わりを伝える。
  let boardIntro: TutorialBoardIntro | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    onIntroEnd = vi.fn<() => void>();
  });

  function renderOverlay({
    phase = "intro",
    guiding = false,
    finish = { entry: "play", onReturnToPlay: vi.fn() },
  }: {
    phase?: TutorialPhase;
    guiding?: boolean;
    finish?: TutorialFinish;
  } = {}): void {
    render(
      <TutorialOverlay
        open={true}
        title="テストパズル"
        pictogramSvg="<svg></svg>"
        intro={intro}
        rules={[{ id: "rule", label: "ルール", earned: false, current: false }]}
        message={{ headline: "最初の一言", detail: null }}
        phase={phase}
        guiding={guiding}
        finish={finish}
        renderBoard={(currentIntro) => {
          boardIntro = currentIntro;
          return <div role="group" aria-label="盤面" />;
        }}
        onIntroEnd={onIntroEnd}
        onRestart={vi.fn()}
        onClose={vi.fn()}
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
});
