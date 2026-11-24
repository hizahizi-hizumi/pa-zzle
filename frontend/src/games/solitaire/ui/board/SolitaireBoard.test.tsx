import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

import { parseSolitaireCard } from "@/games/solitaire/puzzle/card";
import {
  emptySolitaireFoundations,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";
import { SolitaireBoard } from "@/games/solitaire/ui/board/SolitaireBoard";

afterEach(cleanup);

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
    onPressPile: vi.fn(),
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

        expect(props.onPressPile).toHaveBeenCalledWith(pile);
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

      expect(props.onPressPile).not.toHaveBeenCalled();
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
