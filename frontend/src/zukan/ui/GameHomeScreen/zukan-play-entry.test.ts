import type { Mock } from "vitest";

import {
  _private,
  playZukanPlayEntry,
  type ZukanPlayEntry,
} from "@/zukan/ui/GameHomeScreen/zukan-play-entry";

const { findCenteredScrollTop, ZUKAN_PLAY_ENTRY_DURATION_MS } = _private;

type RecordedAnimation = {
  element: Element;
  finish: () => void;
};

let recorded: RecordedAnimation[];

function recordAnimate(this: Element): Animation {
  let resolveFinished: (animation: Animation) => void = function noop() {};
  const animation = {
    finished: new Promise<Animation>((resolve) => {
      resolveFinished = resolve;
    }),
    cancel() {},
  } as unknown as Animation;
  recorded.push({
    element: this,
    finish: () => resolveFinished(animation),
  });
  return animation;
}

async function flushPromises() {
  await vi.advanceTimersByTimeAsync(0);
}

async function finishAnimationsOf(element: Element | null) {
  for (const animation of recorded.filter(
    (entry) => entry.element === element,
  )) {
    animation.finish();
  }
  await flushPromises();
}

function queryPieceLayer(): Element | null {
  return document.querySelector("[data-zukan-play-entry-piece]");
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

/** マスは台紙の見えている範囲より下にある。 */
function renderHome(): Omit<
  ZukanPlayEntry,
  "piecePath" | "pictogramSvg" | "spinsToPiece" | "onEnter"
> {
  document.body.innerHTML = `
    <div data-testid="screen">
      <div data-testid="scroller">
        <button data-testid="square"><svg></svg></button>
      </div>
    </div>`;
  const screen = document.querySelector<HTMLElement>('[data-testid="screen"]');
  const scroller = document.querySelector<HTMLElement>(
    '[data-testid="scroller"]',
  );
  const square = document.querySelector<HTMLElement>('[data-testid="square"]');
  if (!screen || !scroller || !square) {
    throw new Error("画面を作れない");
  }
  stubRect(scroller, { top: 0, height: 200 });
  stubRect(square, { left: 40, top: 500, width: 20, height: 20 });
  stubScroller(scroller, { scrollHeight: 1000, clientHeight: 200 });
  return { screen, scroller, square };
}

const piecePath = "M0,0h1v1h-1z";
const pictogramSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><circle data-testid="pictogram" cx="4" cy="4" r="3"/></svg>';

let onEnter: Mock<() => void>;
let home: ReturnType<typeof renderHome>;
/** 始めた演出を飛ばす関数。飛ばさずに終えたテストの演出が、window への操作を次のテストまで受け続けないよう、終わりに飛ばす。 */
let skips: (() => void)[];
let cancels: (() => void)[];

function startEntry(options: Pick<ZukanPlayEntry, "spinsToPiece">): () => void {
  const { skip, cancel } = playZukanPlayEntry({
    ...home,
    piecePath,
    pictogramSvg,
    onEnter,
    ...options,
  });
  skips.push(skip);
  cancels.push(cancel);
  return skip;
}

beforeEach(() => {
  vi.useFakeTimers();
  recorded = [];
  onEnter = vi.fn();
  home = renderHome();
  skips = [];
  cancels = [];
});

afterEach(() => {
  for (const skip of skips) {
    skip();
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, "animate");
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
  describe("動かせない環境の場合", () => {
    test("何も動かさず、すぐに onEnter を1回呼ぶこと", () => {
      startEntry({ spinsToPiece: true });

      expect(onEnter).toHaveBeenCalledTimes(1);
      expect(queryPieceLayer()).toBeNull();
      expect(home.scroller.scrollTop).toBe(0);
    });
  });

  describe("動かせる環境の場合", () => {
    beforeEach(() => {
      Element.prototype.animate = recordAnimate as Element["animate"];
    });

    describe("動きを減らす設定の場合", () => {
      beforeEach(() => {
        vi.stubGlobal(
          "matchMedia",
          vi.fn(() => ({ matches: true }) as unknown as MediaQueryList),
        );
      });

      test("何も動かさず、すぐに onEnter を1回呼ぶこと", () => {
        startEntry({ spinsToPiece: true });

        expect(onEnter).toHaveBeenCalledTimes(1);
        expect(recorded).toEqual([]);
        expect(queryPieceLayer()).toBeNull();
      });
    });

    describe("台紙を送らずに抜き始めた場合", () => {
      let skip: () => void;

      beforeEach(() => {
        stubRect(home.square, { left: 40, top: 100, width: 20, height: 20 });
        skip = startEntry({ spinsToPiece: false });
      });

      test("ピースの層を document.body に置いてマスを隠し、ピースの面にピクトグラムを浮かべ、画面を引きながら運び始め、まだ onEnter を呼ばないこと", () => {
        const layer = queryPieceLayer();
        const pieceFace = layer?.querySelector("[data-zukan-play-entry-face]");
        const animatedElements = recorded.map(({ element }) => element);

        expect(layer?.parentElement).toBe(document.body);
        expect(layer?.querySelector("path")?.getAttribute("d")).toBe(piecePath);
        expect(home.square.style.visibility).toBe("hidden");
        expect(animatedElements).toEqual([pieceFace, home.screen, layer]);
        expect(pieceFace?.querySelector('[data-testid="pictogram"]')).not.toBe(
          null,
        );
        expect(onEnter).not.toHaveBeenCalled();
      });

      test("運び終えると onEnter を1回呼び、層を残して消し始めること", async () => {
        const layer = queryPieceLayer();

        await finishAnimationsOf(layer);

        expect(onEnter).toHaveBeenCalledTimes(1);
        expect(queryPieceLayer()).toBe(layer);
        expect(
          recorded.filter(({ element }) => element === layer),
        ).toHaveLength(2);
      });

      test("消し終えると層を取り除き、onEnter を呼び直さないこと", async () => {
        const layer = queryPieceLayer();

        await finishAnimationsOf(layer);
        await finishAnimationsOf(layer);

        expect(queryPieceLayer()).toBeNull();
        expect(onEnter).toHaveBeenCalledTimes(1);
      });

      const skipEvents = [
        ["pointerdown", () => new PointerEvent("pointerdown")],
        ["keydown", () => new KeyboardEvent("keydown", { key: "Escape" })],
      ] as const;

      test.each(skipEvents)(
        "動きの間に window へ届いた操作で飛ばし、すぐに onEnter を1回呼ぶこと: %s",
        async (_, createEvent) => {
          window.dispatchEvent(createEvent());
          const calledOnSkip = onEnter.mock.calls.length;
          await finishAnimationsOf(queryPieceLayer());

          expect(calledOnSkip).toBe(1);
          expect(onEnter).toHaveBeenCalledTimes(1);
        },
      );

      describe("運び終えた場合", () => {
        let animationCount: number;

        beforeEach(async () => {
          await finishAnimationsOf(queryPieceLayer());
          animationCount = recorded.length;
        });

        test("window へ届いた操作を受けないこと", () => {
          window.dispatchEvent(new PointerEvent("pointerdown"));
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

          expect(recorded).toHaveLength(animationCount);
          expect(onEnter).toHaveBeenCalledTimes(1);
        });
      });

      test("始める前にやめると、onEnter を呼ばず、ピースの層を取り除いてマスを戻し、運び終えても始めないこと", async () => {
        const layer = queryPieceLayer();

        cancels[0]?.();
        await finishAnimationsOf(layer);

        expect(onEnter).not.toHaveBeenCalled();
        expect(queryPieceLayer()).toBeNull();
        expect(home.square.style.visibility).toBe("");
      });

      describe("運び終えて始めたあと", () => {
        beforeEach(async () => {
          await finishAnimationsOf(queryPieceLayer());
        });

        test("やめても、消していくピースの層を取り除かないこと", () => {
          cancels[0]?.();

          expect(onEnter).toHaveBeenCalledTimes(1);
          expect(queryPieceLayer()).not.toBeNull();
        });
      });

      test("返り値の関数で飛ばすと、すぐに onEnter を呼び、運び終えても呼び直さないこと", async () => {
        skip();
        const calledOnSkip = onEnter.mock.calls.length;
        await finishAnimationsOf(queryPieceLayer());

        expect(calledOnSkip).toBe(1);
        expect(onEnter).toHaveBeenCalledTimes(1);
      });
    });

    describe("抜くピースが台紙の見えている範囲の外にあり、台紙を送らずに抜く場合", () => {
      beforeEach(() => {
        startEntry({ spinsToPiece: false });
      });

      test("ピースを見える所へ送ってから抜くこと", async () => {
        await vi.advanceTimersByTimeAsync(
          ZUKAN_PLAY_ENTRY_DURATION_MS.spin + 50,
        );

        expect(home.scroller.scrollTop).toBe(410);
        expect(queryPieceLayer()).not.toBeNull();
      });
    });

    describe("台紙を送ってから抜く動きを始めた場合", () => {
      let skip: () => void;

      beforeEach(() => {
        skip = startEntry({ spinsToPiece: true });
      });

      test("送っている間はピースを抜かず、onEnter を呼ばないこと", async () => {
        await vi.advanceTimersByTimeAsync(
          ZUKAN_PLAY_ENTRY_DURATION_MS.spin / 2,
        );

        expect(home.scroller.scrollTop).toBeGreaterThan(0);
        expect(home.scroller.scrollTop).toBeLessThan(410);
        expect(queryPieceLayer()).toBeNull();
        expect(onEnter).not.toHaveBeenCalled();
      });

      test("抜くピースが台紙の見えている高さの中央へ来る位置まで送ってから、ピースを抜くこと", async () => {
        await vi.advanceTimersByTimeAsync(
          ZUKAN_PLAY_ENTRY_DURATION_MS.spin + 50,
        );

        expect(home.scroller.scrollTop).toBe(410);
        expect(queryPieceLayer()?.parentElement).toBe(document.body);
      });

      describe("送っている途中", () => {
        beforeEach(async () => {
          await vi.advanceTimersByTimeAsync(
            ZUKAN_PLAY_ENTRY_DURATION_MS.spin / 2,
          );
        });

        test("飛ばすと、すぐに onEnter を1回呼び、送るのをやめてピースを抜かないこと", async () => {
          skip();
          const scrollTopOnSkip = home.scroller.scrollTop;
          await vi.advanceTimersByTimeAsync(ZUKAN_PLAY_ENTRY_DURATION_MS.spin);

          expect(onEnter).toHaveBeenCalledTimes(1);
          expect(home.scroller.scrollTop).toBe(scrollTopOnSkip);
          expect(queryPieceLayer()).toBeNull();
        });
      });
    });
  });
});
