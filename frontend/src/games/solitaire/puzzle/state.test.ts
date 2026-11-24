import {
  parseSolitaireCard,
  type SolitaireCard,
} from "@/games/solitaire/puzzle/card";
import {
  countSolitaireFoundationCards,
  createSolitaireInitialState,
  emptySolitaireFoundations,
  findSolitaireRunStart,
  getSolitaireFoundationTop,
  isSameSolitaireState,
  isSolitaireCleared,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";

function cards(text: string): SolitaireCard[] {
  return text
    .split(" ")
    .filter(Boolean)
    .map((cardText) => parseSolitaireCard(cardText)!);
}

describe("findSolitaireRunStart", () => {
  const cases = [
    ["空の列", "", 0],
    ["1枚の列", "7H", 0],
    ["全部が並び", "KS QH JC 10D", 0],
    ["手前の2枚だけが並び", "3D 9S 8H", 1],
    ["同じ色が重なる所で切れる", "10S 9H 8C 7S", 3],
    ["数が飛ぶ所で切れる", "KS QH 10C 9H", 2],
  ] as const;

  test.each(cases)(
    "%sでは %i 枚目から並びが始まること",
    (_, columnText, expected) => {
      const start = findSolitaireRunStart(cards(columnText));

      expect(start).toBe(expected);
    },
  );
});

describe("countSolitaireFoundationCards", () => {
  const foundations = { spades: 13, hearts: 2, diamonds: 0, clubs: 7 };

  test("マークごとの枚数を足すこと", () => {
    const count = countSolitaireFoundationCards(foundations);

    expect(count).toBe(22);
  });
});

describe("getSolitaireFoundationTop", () => {
  const foundations = { spades: 0, hearts: 4, diamonds: 13, clubs: 1 };
  const cases = [
    ["spades", null],
    ["hearts", "4H"],
    ["diamonds", "KD"],
    ["clubs", "AC"],
  ] as const;

  test.each(cases)("%s の組札の一番上が %s であること", (suit, expected) => {
    const top = getSolitaireFoundationTop(foundations, suit);

    expect(top).toBe(expected === null ? null : parseSolitaireCard(expected));
  });
});

describe("isSolitaireCleared", () => {
  const playing: SolitaireState = {
    columns: [[], [], [], [], [], [], cards("KC")],
    stock: [],
    waste: [],
    foundations: { spades: 13, hearts: 13, diamonds: 13, clubs: 12 },
  };
  const cleared: SolitaireState = {
    ...playing,
    columns: [[], [], [], [], [], [], []],
    foundations: { spades: 13, hearts: 13, diamonds: 13, clubs: 13 },
  };

  test("52枚を組札に置いたらクリアであること", () => {
    const result = isSolitaireCleared(cleared);

    expect(result).toBe(true);
  });

  test("1枚でも列に残っていればクリアでないこと", () => {
    const result = isSolitaireCleared(playing);

    expect(result).toBe(false);
  });
});

describe("isSameSolitaireState", () => {
  const columns = [cards("AS"), cards("2S 3S"), [], [], [], [], []];
  const base = createSolitaireInitialState(columns, cards("4S 5S"));
  const cases: readonly (readonly [string, SolitaireState, boolean])[] = [
    [
      "同じ中身の別の配列",
      createSolitaireInitialState(
        columns.map((column) => [...column]),
        cards("4S 5S"),
      ),
      true,
    ],
    [
      "山札をめくった",
      { ...base, stock: cards("5S"), waste: cards("4S") },
      false,
    ],
    [
      "列の札が違う",
      createSolitaireInitialState(
        [cards("AS"), cards("3S 2S"), [], [], [], [], []],
        cards("4S 5S"),
      ),
      false,
    ],
    [
      "組札が違う",
      { ...base, foundations: { ...emptySolitaireFoundations, hearts: 1 } },
      false,
    ],
  ];

  test.each(cases)("%sなら %s を返すこと", (_, other, expected) => {
    const result = isSameSolitaireState(base, other);

    expect(result).toBe(expected);
  });
});
