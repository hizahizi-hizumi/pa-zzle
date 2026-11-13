import type { Mock } from "vitest";

import {
  _private,
  playZukanPlayEntry,
  type ZukanPlayEntry,
} from "@/app/game-home/GameHomeScreen/zukan-play-entry";

const { findCenteredScrollTop, ZUKAN_PLAY_ENTRY_DURATION_MS } = _private;

async function flushFrames(milliseconds: number) {
  await vi.advanceTimersByTimeAsync(milliseconds);
}

function isMarkedAsEntered(square: HTMLElement): boolean {
  return square.hasAttribute("data-zukan-play-entry-dive");
}

function stubRect(element: Element, rect: Partial<DOMRect>) {
  element.getBoundingClientRect = function getStubbedRect() {
    return { left: 0, top: 0, width: 0, height: 0, ...rect } as DOMRect;
  };
}

function stubScroller(
  scroller: HTMLElement,
  {
    scrollHeight,
    clientHeight,
  }: { scrollHeight: number; clientHeight: number },
) {
  let scrollTop = 0;
  Object.defineProperties(scroller, {
    scrollHeight: { configurable: true, value: scrollHeight },
    clientHeight: { configurable: true, value: clientHeight },
    scrollTop: {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    },
  });
}

/** 台紙のスクロール領域と、入るマスを置く。マスは台紙の見えている範囲より下にある。 */
function renderHome(): Pick<ZukanPlayEntry, "scroller" | "square"> {
  document.body.innerHTML = `
    <div data-testid="scroller">
      <button data-testid="square"><svg></svg></button>
    </div>`;
  const scroller = document.querySelector<HTMLElement>(
    '[data-testid="scroller"]',
  );
  const square = document.querySelector<HTMLElement>('[data-testid="square"]');
  if (!scroller || !square) {
    throw new Error("画面を作れない");
  }
  stubRect(scroller, { top: 0, height: 200 });
  stubRect(square, { left: 40, top: 500, width: 20, height: 20 });
  stubScroller(scroller, { scrollHeight: 1000, clientHeight: 200 });
  return { scroller, square };
}

const piecePath = "M0,0h1v1h-1z";
const problemId = "problem-1";

let onEnter: Mock<() => void>;
let home: ReturnType<typeof renderHome>;
/** 始めた演出を飛ばす関数。飛ばさずに終えたテストの演出が、window への操作を次のテストまで受け続けないよう、終わりに飛ばす。 */
let skips: (() => void)[];

function startEntry(
  options: Pick<ZukanPlayEntry, "spinsToPiece">,
): ReturnType<typeof playZukanPlayEntry> {
  const control = playZukanPlayEntry({
    ...home,
    problemId,
    piecePath,
    onEnter,
    ...options,
  });
  skips.push(control.skip);
  return control;
}

beforeEach(() => {
  vi.useFakeTimers();
  onEnter = vi.fn();
  home = renderHome();
  skips = [];
});

afterEach(() => {
  for (const skip of skips) {
    skip();
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "startViewTransition");
  document.body.innerHTML = "";
});

describe("findCenteredScrollTop", () => {
  test("マスの中央が台紙の見えている高さの中央に来るスクロール位置を返すこと", () => {
    const scrollTop = findCenteredScrollTop(home.square, home.scroller);

    expect(scrollTop).toBe(410);
  });

  describe("中央へ運ぶと送れる範囲を超える場合", () => {
    beforeEach(() => {
      stubRect(home.square, { top: 1200, height: 20 });
    });

    test("送れる範囲の端で止めること", () => {
      const scrollTop = findCenteredScrollTop(home.square, home.scroller);

      expect(scrollTop).toBe(800);
    });
  });
});

describe("playZukanPlayEntry", () => {
  describe("画面の行き来の動きを使えない環境の場合", () => {
    test("台紙を送らず、マスに印を付けず、すぐに onEnter を1回呼ぶこと", () => {
      startEntry({ spinsToPiece: true });

      expect(onEnter).toHaveBeenCalledTimes(1);
      expect(home.scroller.scrollTop).toBe(0);
      expect(isMarkedAsEntered(home.square)).toBe(false);
    });
  });

  describe("画面の行き来の動きを使える環境の場合", () => {
    beforeEach(() => {
      Object.defineProperty(document, "startViewTransition", {
        configurable: true,
        value: vi.fn(),
      });
    });

    describe("動きを減らす設定の場合", () => {
      beforeEach(() => {
        vi.stubGlobal(
          "matchMedia",
          vi.fn(() => ({ matches: true })),
        );
      });

      test("台紙を送らず、すぐに onEnter を1回呼ぶこと", () => {
        startEntry({ spinsToPiece: true });

        expect(onEnter).toHaveBeenCalledTimes(1);
        expect(home.scroller.scrollTop).toBe(0);
      });
    });

    describe("入るピースが台紙の見えている範囲にあり、台紙を送らずに入る場合", () => {
      beforeEach(() => {
        stubRect(home.square, { left: 40, top: 100, width: 20, height: 20 });
      });

      test("入るマスに印を付け、すぐに onEnter を1回呼ぶこと", () => {
        startEntry({ spinsToPiece: false });

        expect(isMarkedAsEntered(home.square)).toBe(true);
        expect(onEnter).toHaveBeenCalledTimes(1);
      });
    });

    describe("台紙を送ってから入る場合", () => {
      describe("動きを始めた場合", () => {
        beforeEach(() => {
          startEntry({ spinsToPiece: true });
        });

        test("送っている間は、マスに印を付けず、onEnter を呼ばないこと", async () => {
          await flushFrames(ZUKAN_PLAY_ENTRY_DURATION_MS.spin / 2);

          expect(isMarkedAsEntered(home.square)).toBe(false);
          expect(onEnter).not.toHaveBeenCalled();
        });

        test("入るピースが台紙の見えている高さの中央へ来る位置まで送ってから、マスに印を付けて onEnter を1回呼ぶこと", async () => {
          await flushFrames(ZUKAN_PLAY_ENTRY_DURATION_MS.spin + 50);

          expect(home.scroller.scrollTop).toBe(410);
          expect(isMarkedAsEntered(home.square)).toBe(true);
          expect(onEnter).toHaveBeenCalledTimes(1);
        });

        describe("送っている間に操作が届いた場合", () => {
          const pressCases = [
            ["pointerdown", () => new MouseEvent("pointerdown", { button: 0 })],
            ["keydown", () => new KeyboardEvent("keydown", { key: "Enter" })],
          ] as const;

          test.each(pressCases)(
            "window へ %s が届くと、すぐに onEnter を1回呼ぶこと",
            (_type, createEvent) => {
              window.dispatchEvent(createEvent());

              expect(onEnter).toHaveBeenCalledTimes(1);
            },
          );
        });
      });

      describe("返り値の操作を受け取った場合", () => {
        let control: ReturnType<typeof playZukanPlayEntry>;

        beforeEach(() => {
          control = startEntry({ spinsToPiece: true });
        });

        test("skip で飛ばすと、マスに印を付けずにすぐ onEnter を1回呼び、送り終える時間が過ぎても呼び直さないこと", async () => {
          control.skip();
          await flushFrames(ZUKAN_PLAY_ENTRY_DURATION_MS.spin + 50);

          expect(isMarkedAsEntered(home.square)).toBe(false);
          expect(onEnter).toHaveBeenCalledTimes(1);
        });

        test("cancel でやめると、送り終える時間が過ぎても onEnter を呼ばないこと", async () => {
          control.cancel();
          await flushFrames(ZUKAN_PLAY_ENTRY_DURATION_MS.spin + 50);

          expect(onEnter).not.toHaveBeenCalled();
        });
      });
    });
  });
});
