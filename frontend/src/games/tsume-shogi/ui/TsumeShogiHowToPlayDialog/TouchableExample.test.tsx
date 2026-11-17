import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { HowToPlayExamplePanel } from "@/components/HowToPlayExamplePanel";
import { TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS } from "@/games/tsume-shogi/play/use-tsume-shogi-play";
import { TsumeShogiPieceDefs } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs";
import {
  checkRuleExample,
  interpositionExample,
  mateCountExample,
  mateRuleExample,
  promotionOperationExample,
  type TsumeShogiHowToPlayExample,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/figure-boards";
import { TouchableExample } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/TouchableExample";
import { playLayeredSound, playSound } from "@/lib/audio/sound-effects";

vi.mock("@/lib/audio/sound-effects", () => ({
  REPEATED_SOUND_VARIATION: {},
  defineSoundEffect: (url: string) => ({ url }),
  playLayeredSound: vi.fn(),
  playSound: vi.fn(),
  prepareSoundEffects: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(playSound).mockClear();
  vi.mocked(playLayeredSound).mockClear();
});

function renderExampleElement(example: TsumeShogiHowToPlayExample) {
  return (
    <TsumeShogiPieceDefs>
      <HowToPlayExamplePanel resettable>
        <TouchableExample example={example} />
      </HowToPlayExamplePanel>
    </TsumeShogiPieceDefs>
  );
}

/** 本番と同じく、元に戻すボタンを持つ例の面に置いて描く。返す関数は、同じ例のまま親から描き直す。 */
function renderExample(example: TsumeShogiHowToPlayExample): () => void {
  const { rerender } = render(renderExampleElement(example));
  return function rerenderExample() {
    rerender(renderExampleElement(example));
  };
}

/** 駒の着地の動き。動かした回数を数え、すぐ終える。 */
const animate = vi.fn(function createFinishedAnimation(): Animation {
  return {
    finished: Promise.resolve(),
    cancel: vi.fn(),
  } as unknown as Animation;
});

function getBoard(): HTMLElement {
  return screen.getByRole("group", { name: "盤" });
}

/** 盤の升。本番の盤面と同じ読み上げ名（升の名前と、あれば駒）で探す。 */
function getSquare(name: string): HTMLElement {
  return within(getBoard()).getByRole("button", {
    name: new RegExp(`^${name}( |$)`),
  });
}

function getHandPiece(name: string): HTMLElement {
  return within(screen.getByRole("group", { name: "攻方の持駒" })).getByRole(
    "button",
    { name: new RegExp(`^${name} `) },
  );
}

/** 鳴らした効果音の音声ファイルの名前。 */
function readPlayedSounds(): string[] {
  return vi
    .mocked(playSound)
    .mock.calls.map(([sound]) =>
      String((sound as unknown as { url: string }).url),
    );
}

function countHints(): number {
  return document.querySelectorAll("[data-how-to-play-press-hint]").length;
}

/** 盤の升に付けた ✓ / ✕ の札。 */
function listCandidateMarks(verdict?: "allowed" | "disallowed"): Element[] {
  const selector =
    verdict === undefined
      ? "[data-how-to-play-verdict-mark]"
      : `[data-how-to-play-verdict-mark="${verdict}"]`;
  return [...getBoard().querySelectorAll(selector)];
}

function getResetButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", {
    name: "例を元に戻す",
  });
}

describe("TouchableExample", () => {
  describe("王手だけを指せるルールの例の場合", () => {
    beforeEach(() => {
      renderExample(checkRuleExample);
    });

    test("最初は選んだ金の行き先に札を付け、王手にならない升に手がかりを付け、凡例を添えること", () => {
      const allowed = listCandidateMarks("allowed");
      const disallowed = listCandidateMarks("disallowed");

      expect(allowed).toHaveLength(2);
      expect(disallowed).toHaveLength(4);
      expect(countHints()).toBe(1);
      expect(
        screen.getByRole("figure", { name: /指せる、指せない/ }),
      ).toBeTruthy();
    });

    test("王手にならない升を押すと、本番と同じ着手させない音を鳴らし、手がかりを消して指せないと言い、元に戻すボタンを出すこと", () => {
      fireEvent.click(getSquare("3四"));

      expect(readPlayedSounds()).toEqual([expect.stringContaining("rejected")]);
      expect(countHints()).toBe(0);
      expect(screen.getByRole("figure", { name: "指せない" })).toBeTruthy();
      expect(getResetButton().disabled).toBe(false);
    });

    describe("王手にならない升で弾かれた場合", () => {
      beforeEach(() => {
        fireEvent.click(getSquare("3四"));
      });

      test("選んだ金を押して選ぶのをやめると、札と凡例を消して、金に手がかりを付けること", () => {
        fireEvent.click(getSquare("3三"));

        expect(listCandidateMarks()).toHaveLength(0);
        expect(countHints()).toBe(1);
      });
    });
  });

  describe("王手を指す場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      renderExample(checkRuleExample);
    });

    test("2二に指すと、本番と同じ指した音を鳴らし、元に戻すボタンを出すこと", () => {
      fireEvent.click(getSquare("2二"));

      expect(readPlayedSounds()).toEqual([expect.stringContaining("moved")]);
      expect(getResetButton().disabled).toBe(false);
    });

    describe("2二に指した後の場合", () => {
      beforeEach(() => {
        fireEvent.click(getSquare("2二"));
      });

      test("本番と同じ間を置いて、玉方が金を取らずに逃げる手を指し、応手の音を鳴らすこと", () => {
        act(() => {
          vi.advanceTimersByTime(TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS);
        });

        expect(readPlayedSounds()).toEqual([
          expect.stringContaining("moved"),
          expect.stringContaining("replied"),
        ]);
        expect(getSquare("1三").getAttribute("aria-label")).toBe(
          "1三 玉方の玉",
        );
        expect(getSquare("2二").getAttribute("aria-label")).toBe(
          "2二 攻方の金",
        );
      });

      test("元に戻すボタンを押すと、最初の姿に戻すこと", () => {
        fireEvent.click(getResetButton());

        expect(getSquare("3三").getAttribute("aria-label")).toBe(
          "3三 攻方の金",
        );
        expect(getSquare("3三").getAttribute("aria-pressed")).toBe("true");
        expect(getResetButton().disabled).toBe(true);
      });
    });
  });

  describe("詰ませるルールの例の場合", () => {
    beforeEach(() => {
      renderExample(mateRuleExample);
    });

    test("詰む升に金を打つと、本番と同じ詰みの音を鳴らし、詰んだと言うこと", () => {
      fireEvent.click(getSquare("3二"));

      expect(vi.mocked(playLayeredSound)).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("figure", { name: "詰んだ" })).toBeTruthy();
    });
  });

  describe("手数のルールの例の場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      renderExample(mateCountExample);
    });

    test("持駒の銀を押すと、手がかりを打つ升へ移すこと", () => {
      fireEvent.click(getHandPiece("銀"));

      expect(countHints()).toBe(1);
      expect(
        getHandPiece("銀").querySelector("[data-how-to-play-press-hint]"),
      ).toBeNull();
    });

    test("銀を2三に打つと、玉方の応手を待つ間は手がかりを消すこと", () => {
      fireEvent.click(getHandPiece("銀"));
      fireEvent.click(getSquare("2三"));

      expect(countHints()).toBe(0);
    });

    describe("銀を2三に打った場合", () => {
      beforeEach(() => {
        fireEvent.click(getHandPiece("銀"));
        fireEvent.click(getSquare("2三"));
      });

      test("玉方の応手の後に、次の手の手がかりを出し、残りの手数を言うこと", () => {
        act(() => {
          vi.advanceTimersByTime(TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS);
        });

        expect(countHints()).toBe(1);
        expect(screen.getByRole("figure", { name: "あと1手" })).toBeTruthy();
        expect(screen.getByRole("status").textContent).toBe("▲2三銀△2一玉");
      });
    });
  });

  describe("玉方の持駒のルールの例で香車を打った場合", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      renderExample(interpositionExample);
      fireEvent.click(getHandPiece("香車"));
      fireEvent.click(getSquare("1三"));
    });

    test("本番と同じ間を置いて、玉方が駒箱の飛車を間に打ち、そのことを言うこと", () => {
      act(() => {
        vi.advanceTimersByTime(TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS);
      });

      expect(getSquare("1二").getAttribute("aria-label")).toBe(
        "1二 玉方の飛車",
      );
      expect(
        screen.getByRole("figure", { name: "飛車を間に打って防いだ" }),
      ).toBeTruthy();
    });
  });

  describe("駒の着地の動き", () => {
    let rerenderExample: () => void;

    beforeEach(() => {
      animate.mockClear();
      Element.prototype.animate = animate as unknown as Element["animate"];
    });

    afterEach(() => {
      Reflect.deleteProperty(Element.prototype, "animate");
    });

    describe("最初から手を指してある例の場合", () => {
      beforeEach(() => {
        rerenderExample = renderExample(mateRuleExample);
      });

      test("開いたときも、親から描き直したときも、指してある手を動かさないこと", () => {
        rerenderExample();

        expect(animate).not.toHaveBeenCalled();
      });
    });

    describe("王手を指して玉方が応じた後の場合", () => {
      let animatedBefore: number;

      beforeEach(() => {
        vi.useFakeTimers();
        rerenderExample = renderExample(checkRuleExample);
        fireEvent.click(getSquare("2二"));
        act(() => {
          vi.advanceTimersByTime(TSUME_SHOGI_DEFENDER_REPLY_DELAY_MS);
        });
        animatedBefore = animate.mock.calls.length;
      });

      test("指した手と応手を動かして見せること", () => {
        const animated = animatedBefore;

        expect(animated).toBeGreaterThan(0);
      });

      test("親から描き直しても、同じ手を動かし直さないこと", () => {
        rerenderExample();

        const animatedAgain = animate.mock.calls.length - animatedBefore;

        expect(animatedAgain).toBe(0);
      });

      test("駒を選んでも、同じ手を動かし直さないこと", () => {
        fireEvent.click(getSquare("2二"));

        const animatedAgain = animate.mock.calls.length - animatedBefore;

        expect(animatedAgain).toBe(0);
      });
    });
  });

  describe("成・不成の操作の例の場合", () => {
    beforeEach(() => {
      renderExample(promotionOperationExample);
    });

    test("飛車を1三へ動かすと、本番と同じ成・不成の選択肢を出し、成に手がかりを付け、玉を選択肢で隠さないこと", () => {
      fireEvent.click(getSquare("3三"));
      fireEvent.click(getSquare("1三"));

      const picker = screen.getByRole("group", { name: "成・不成" });
      expect(within(picker).getByRole("button", { name: "成" })).toBeTruthy();
      expect(countHints()).toBe(1);
      expect(getSquare("1一").getAttribute("aria-label")).toBe("1一 玉方の玉");
    });

    describe("飛車を1三へ動かした場合", () => {
      beforeEach(() => {
        fireEvent.click(getSquare("3三"));
        fireEvent.click(getSquare("1三"));
      });

      test("成を押すと、龍で指すこと", () => {
        fireEvent.click(screen.getByRole("button", { name: "成" }));

        expect(getSquare("1三").getAttribute("aria-label")).toBe(
          "1三 攻方の龍",
        );
      });
    });
  });
});
