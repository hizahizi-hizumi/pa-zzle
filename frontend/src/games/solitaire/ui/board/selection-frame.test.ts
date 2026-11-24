import { _private as cardPrivate } from "@/games/solitaire/puzzle/card";
import { getSolitaireColumnSelectionFrame } from "@/games/solitaire/ui/board/selection-frame";

const { parseSolitaireCard } = cardPrivate;

function parseCards(text: string) {
  return text.split(" ").map((card) => parseSolitaireCard(card)!);
}

describe("getSolitaireColumnSelectionFrame", () => {
  const cases = [
    [
      "奥に並びでない札がある列は、手前から続く並びだけ",
      "5D 9C 8H 7S",
      10,
      220,
    ],
    ["1枚だけの列は、その札", "KH", 0, 200],
  ] as const;

  test.each(cases)("%sを囲む上端と高さを返すこと", (_, cards, top, height) => {
    const frame = getSolitaireColumnSelectionFrame({
      column: parseCards(cards),
      offset: 10,
      cardHeight: 200,
    });

    expect(frame).toEqual({ top, height });
  });
});
