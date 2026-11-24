import {
  canStackSolitaireCard,
  createSolitaireCard,
  formatSolitaireCard,
  getSolitaireCardRank,
  getSolitaireCardSuit,
  isRedSolitaireCard,
  isSolitaireCard,
  parseSolitaireCard,
  SOLITAIRE_CARD_COUNT,
} from "@/games/solitaire/puzzle/card";

const allCards = Array.from(
  { length: SOLITAIRE_CARD_COUNT },
  (_, card) => card,
);

describe("createSolitaireCard", () => {
  test("マークと数から作った札が、同じマークと数を返すこと", () => {
    const roundTripped = allCards.map((card) =>
      createSolitaireCard(
        getSolitaireCardSuit(card),
        getSolitaireCardRank(card),
      ),
    );

    expect(roundTripped).toEqual(allCards);
  });
});

describe("formatSolitaireCard", () => {
  const cases = [
    [createSolitaireCard("spades", 1), "AS"],
    [createSolitaireCard("hearts", 10), "10H"],
    [createSolitaireCard("diamonds", 12), "QD"],
    [createSolitaireCard("clubs", 13), "KC"],
  ] as const;

  test.each(cases)("札 %i を %s と書くこと", (card, expected) => {
    const text = formatSolitaireCard(card);

    expect(text).toBe(expected);
  });
});

describe("parseSolitaireCard", () => {
  test("書いた字を読むと同じ札に戻ること", () => {
    const parsed = allCards.map((card) =>
      parseSolitaireCard(formatSolitaireCard(card)),
    );

    expect(parsed).toEqual(allCards);
  });

  const invalidTexts = ["", "1S", "11H", "KX", "A", "10"];

  test.each(invalidTexts)("札でない字 %j は null になること", (text) => {
    const parsed = parseSolitaireCard(text);

    expect(parsed).toBeNull();
  });
});

describe("isRedSolitaireCard", () => {
  test("ハートとダイヤだけが赤いこと", () => {
    const redSuits = new Set(
      allCards.filter(isRedSolitaireCard).map(getSolitaireCardSuit),
    );

    expect([...redSuits].sort()).toEqual(["diamonds", "hearts"]);
  });
});

describe("isSolitaireCard", () => {
  const cases = [
    [0, true],
    [51, true],
    [52, false],
    [-1, false],
    [1.5, false],
    ["0", false],
  ] as const;

  test.each(cases)("%j を札と見なすかが %s であること", (value, expected) => {
    const result = isSolitaireCard(value);

    expect(result).toBe(expected);
  });
});

describe("canStackSolitaireCard", () => {
  const cases = [
    ["数が1つ小さく色が違う", "9H", "10S", true],
    ["黒の上に赤", "QD", "KC", true],
    ["同じ色", "9C", "10S", false],
    ["数が同じ", "10H", "10S", false],
    ["数が1つ大きい", "JH", "10S", false],
    ["数が2つ小さい", "8H", "10S", false],
  ] as const;

  test.each(cases)(
    "%sなら %s を %s に重ねられるかが %s であること",
    (_, cardText, baseText, expected) => {
      const result = canStackSolitaireCard(
        parseSolitaireCard(cardText)!,
        parseSolitaireCard(baseText)!,
      );

      expect(result).toBe(expected);
    },
  );
});
