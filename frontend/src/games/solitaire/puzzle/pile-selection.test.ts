import { _private as cardPrivate } from "@/games/solitaire/puzzle/card";
import {
  isSameSolitairePile,
  type SolitairePile,
  selectSolitairePile,
} from "@/games/solitaire/puzzle/pile-selection";
import type { SolitaireSource } from "@/games/solitaire/puzzle/rules";
import {
  emptySolitaireFoundations,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";

const { parseSolitaireCard } = cardPrivate;

function parseCards(text: string) {
  return text === ""
    ? []
    : text.split(" ").map((card) => parseSolitaireCard(card)!);
}

// 列1 の 9♣ 8♥ 7♠ は並びで、列2 の 10♥ へまとめて置ける。列3 は空き。♥ の組札は A まで、捨て札の一番上は 2♥。
const state: SolitaireState = {
  columns: [
    parseCards("5D 9C 8H 7S"),
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
const stock: SolitairePile = { pile: "stock" };
const waste: SolitairePile = { pile: "waste" };
const column = (columnIndex: number) =>
  ({ pile: "column", columnIndex }) as const;
const foundation = (suit: "spades" | "hearts" | "diamonds" | "clubs") =>
  ({ pile: "foundation", suit }) as const;

describe("selectSolitairePile", () => {
  describe("山札を押した場合", () => {
    const cases: [string, SolitaireState, SolitaireSource | null, unknown][] = [
      [
        "山札が残っていれば1枚めくる",
        state,
        null,
        { type: "move", move: { kind: "draw" } },
      ],
      [
        "置き元を選んでいても1枚めくる",
        state,
        column(0),
        { type: "move", move: { kind: "draw" } },
      ],
      [
        "山札が空なら捨て札を山札へ戻す",
        { ...state, stock: [] },
        null,
        { type: "move", move: { kind: "recycle" } },
      ],
      [
        "山札も捨て札も空なら受け付けない",
        { ...state, stock: [], waste: [] },
        null,
        { type: "invalid", pile: stock },
      ],
    ];

    test.each(cases)("%sこと", (_, current, selected, expected) => {
      const selection = selectSolitairePile(current, selected, stock);

      expect(selection).toEqual(expected);
    });
  });

  describe("置き元を選んでいない場合", () => {
    const cases = [
      ["札のある列", column(0), { type: "source-selected", source: column(0) }],
      ["捨て札", waste, { type: "source-selected", source: waste }],
      [
        "札のある組札",
        foundation("hearts"),
        { type: "source-selected", source: foundation("hearts") },
      ],
      ["空いた列", column(2), { type: "invalid", pile: column(2) }],
      [
        "空の組札",
        foundation("spades"),
        { type: "invalid", pile: foundation("spades") },
      ],
    ] as const;

    test.each(cases)("%sを押した結果を返すこと", (_, pile, expected) => {
      const selection = selectSolitairePile(state, null, pile);

      expect(selection).toEqual(expected);
    });
  });

  describe("置き元を選んでいる場合", () => {
    const cases = [
      [
        "同じ山を押すと選ぶのをやめる",
        column(0),
        column(0),
        { type: "source-deselected", source: column(0) },
      ],
      [
        "置ける列へ、置ける所からの並びをまとめて置く",
        column(0),
        column(1),
        {
          type: "move",
          move: {
            kind: "transfer",
            source: column(0),
            destination: column(1),
            cardCount: 3,
          },
        },
      ],
      [
        "どのマークの組札を押しても札のマークの組札へ置く",
        waste,
        foundation("clubs"),
        {
          type: "move",
          move: {
            kind: "transfer",
            source: waste,
            destination: { pile: "foundation" },
            cardCount: 1,
          },
        },
      ],
      [
        "置けない列は受け付けない",
        column(0),
        column(3),
        { type: "invalid", pile: column(3) },
      ],
      [
        "捨て札へは置けない",
        column(1),
        waste,
        { type: "invalid", pile: waste },
      ],
    ] as const;

    test.each(cases)("%sこと", (_, selected, pile, expected) => {
      const selection = selectSolitairePile(state, selected, pile);

      expect(selection).toEqual(expected);
    });
  });
});

describe("isSameSolitairePile", () => {
  const cases = [
    ["同じ列", column(1), column(1), true],
    ["別の列", column(1), column(2), false],
    ["同じマークの組札", foundation("hearts"), foundation("hearts"), true],
    ["別のマークの組札", foundation("hearts"), foundation("spades"), false],
    ["山札と捨て札", stock, waste, false],
  ] as const;

  test.each(cases)("%sかを見分けること", (_, left, right, expected) => {
    const same = isSameSolitairePile(left, right);

    expect(same).toBe(expected);
  });
});
