import {
  getSolitaireCardRank,
  getSolitaireCardSuit,
  type SolitaireCard,
  type SolitaireSuit,
} from "@/games/solitaire/puzzle/card";

export const solitaireSuitSymbols = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
} as const satisfies Record<SolitaireSuit, string>;

const rankTexts: Readonly<Record<number, string>> = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K",
};

/** 札の隅に書く数。A・J・Q・K は字で、ほかは数字で書く。 */
export function formatSolitaireRank(card: SolitaireCard): string {
  const rank = getSolitaireCardRank(card);
  return rankTexts[rank] ?? String(rank);
}

/** 読み上げや診断で札を呼ぶ名前（`♥10`・`♠A`）。 */
export function formatSolitaireCardName(card: SolitaireCard): string {
  return `${solitaireSuitSymbols[getSolitaireCardSuit(card)]}${formatSolitaireRank(card)}`;
}
