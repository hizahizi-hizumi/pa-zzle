import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

import { _private as cardPrivate } from "@/games/solitaire/puzzle/card";
import {
  emptySolitaireFoundations,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";
import { SolitaireBoard } from "@/games/solitaire/ui/board/SolitaireBoard";

const { parseSolitaireCard } = cardPrivate;

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLElement.prototype, "animate");
  Reflect.deleteProperty(window, "ResizeObserver");
  vi.unstubAllGlobals();
});

/** 盤面を 320×900px と測らせ、札の位置が決まるようにする。 */
function installBoardSize() {
  window.ResizeObserver = vi.fn(function ResizeObserver(
    callback: ResizeObserverCallback,
  ) {
    return {
      observe() {
        callback(
          [{ contentRect: { width: 320, height: 900 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      },
      unobserve() {},
      disconnect() {},
    };
  }) as unknown as typeof ResizeObserver;
}

/** 要素ごとに、`animate` に渡した最初の形を記録する。 */
function installAnimations() {
  const animated: { element: HTMLElement; keyframes: Keyframe[] }[] = [];
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value(this: HTMLElement, keyframes: Keyframe[]) {
      animated.push({ element: this, keyframes });
      return {
        finished: new Promise<void>(() => undefined),
        finish() {},
        cancel() {},
      } as unknown as Animation;
    },
  });
  return animated;
}

function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reduced })),
  );
}

function parseCards(text: string) {
  return text === ""
    ? []
    : text.split(" ").map((card) => parseSolitaireCard(card)!);
}

const state: SolitaireState = {
  columns: [
    parseCards("5D 9C 8H"),
    parseCards("10H"),
    [],
    parseCards("3C"),
    parseCards("4D"),
    parseCards("6S"),
    parseCards("JD"),
  ],
  stock: parseCards("QS KS"),
  waste: parseCards("2H"),
  foundations: { ...emptySolitaireFoundations, hearts: 1 },
};

function createProps(): ComponentProps<typeof SolitaireBoard> {
  return {
    state,
    selectedSource: null,
    operation: null,
    interactionDisabled: false,
    onSelectPile: vi.fn(),
  };
}

describe("SolitaireBoard", () => {
  describe("プレイ中の場合", () => {
    let props: ComponentProps<typeof SolitaireBoard>;

    beforeEach(() => {
      props = { ...createProps(), selectedSource: { pile: "waste" } };
      render(<SolitaireBoard {...props} />);
    });

    const pileCases = [
      ["山札、残り2枚", { pile: "stock" }],
      ["捨て札、♥2", { pile: "waste" }],
      ["♥の組札、♥A", { pile: "foundation", suit: "hearts" }],
      ["♠の組札、なし", { pile: "foundation", suit: "spades" }],
      ["列1、♦5 ♣9 ♥8", { pile: "column", columnIndex: 0 }],
      ["列3、空", { pile: "column", columnIndex: 2 }],
    ] as const;

    test.each(pileCases)(
      "「%s」の山を押すと、その山を知らせること",
      (name, pile) => {
        fireEvent.click(screen.getByRole("button", { name }));

        expect(props.onSelectPile).toHaveBeenCalledWith(pile);
      },
    );

    test("置き元に選んだ山だけを押された状態にすること", () => {
      const pressed = screen
        .getAllByRole("button", { pressed: true })
        .map((button) => button.getAttribute("aria-label"));

      expect(pressed).toEqual(["捨て札、♥2"]);
    });
  });

  describe("操作を受け付けない場合", () => {
    let props: ComponentProps<typeof SolitaireBoard>;

    beforeEach(() => {
      props = { ...createProps(), interactionDisabled: true };
      render(<SolitaireBoard {...props} />);
    });

    test("山を押しても知らせないこと", () => {
      fireEvent.click(screen.getByRole("button", { name: "山札、残り2枚" }));

      expect(props.onSelectPile).not.toHaveBeenCalled();
    });
  });

  describe("列から列へ並びを動かした場合", () => {
    const after: SolitaireState = {
      ...state,
      columns: [
        parseCards("5D"),
        parseCards("10H 9C 8H"),
        ...state.columns.slice(2),
      ],
    };
    let animated: ReturnType<typeof installAnimations>;

    beforeEach(() => {
      installBoardSize();
      animated = installAnimations();
    });

    const operation = {
      id: 1,
      type: "moved",
      move: {
        kind: "transfer",
        source: { pile: "column", columnIndex: 0 },
        destination: { pile: "column", columnIndex: 1 },
        cardCount: 2,
      },
      stateBefore: state,
      isClearingMove: false,
    } as const;

    /** 盤面の大きさを測ってから手を打つ。 */
    function renderMove() {
      const { rerender } = render(<SolitaireBoard {...createProps()} />);
      rerender(
        <SolitaireBoard
          {...createProps()}
          state={after}
          operation={operation}
        />,
      );
    }

    describe("動きを減らす設定でない場合", () => {
      beforeEach(() => {
        stubReducedMotion(false);
        renderMove();
      });

      test("動かした2枚を、置き元の列の位置から置き先の列へ移すこと", () => {
        const starts = animated.map(({ keyframes }) => keyframes[0]?.transform);

        expect(starts).toEqual([
          "translate(-44px, 0px)",
          "translate(-44px, 0px)",
        ]);
      });
    });

    describe("動きを減らす設定の場合", () => {
      beforeEach(() => {
        stubReducedMotion(true);
        renderMove();
      });

      test("札を動かさないこと", () => {
        expect(animated).toEqual([]);
      });
    });
  });

  describe("置けない山を選んだ場合", () => {
    let animated: ReturnType<typeof installAnimations>;

    beforeEach(() => {
      installBoardSize();
      stubReducedMotion(false);
      animated = installAnimations();
    });

    describe("置き元を選んでいる場合", () => {
      beforeEach(() => {
        const { rerender } = render(
          <SolitaireBoard
            {...createProps()}
            selectedSource={{ pile: "column", columnIndex: 0 }}
          />,
        );
        rerender(
          <SolitaireBoard
            {...createProps()}
            selectedSource={{ pile: "column", columnIndex: 0 }}
            operation={{
              id: 1,
              type: "invalid",
              pile: { pile: "column", columnIndex: 3 },
            }}
          />,
        );
      });

      test("選んだ並びの札と囲む枠を置けない列へ向けて戻し、置けない列を当たった向きへ押すこと", () => {
        const targets = animated.map(({ element }) =>
          element.closest("button")?.getAttribute("aria-label"),
        );

        expect(targets).toEqual([
          "列1、♦5 ♣9 ♥8",
          "列1、♦5 ♣9 ♥8",
          "列1、♦5 ♣9 ♥8",
          "列4、♣3",
        ]);
      });
    });

    describe("置き元を選んでいない場合", () => {
      beforeEach(() => {
        render(
          <SolitaireBoard
            {...createProps()}
            operation={{
              id: 1,
              type: "invalid",
              pile: { pile: "column", columnIndex: 2 },
            }}
          />,
        );
      });

      test("押した山を横に揺らすこと", () => {
        const targets = animated.map(({ element }) =>
          element.getAttribute("aria-label"),
        );

        expect(targets).toEqual(["列3、空"]);
      });
    });
  });

  describe("クリアの手を打った場合", () => {
    let props: ComponentProps<typeof SolitaireBoard>;

    beforeEach(() => {
      vi.useFakeTimers();
      props = {
        ...createProps(),
        operation: {
          id: 1,
          type: "moved",
          move: {
            kind: "transfer",
            source: { pile: "column", columnIndex: 1 },
            destination: { pile: "foundation" },
            cardCount: 1,
          },
          stateBefore: state,
          isClearingMove: true,
        },
        onClearAnimationComplete: vi.fn(),
      };
      render(<SolitaireBoard {...props} />);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("組札を照らし終えたらクリア演出の完了を知らせること", async () => {
      await vi.runAllTimersAsync();

      expect(props.onClearAnimationComplete).toHaveBeenCalledOnce();
    });
  });
});
