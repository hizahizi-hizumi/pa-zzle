export const solitaireSuits = [
  "spades",
  "hearts",
  "diamonds",
  "clubs",
] as const;

export type SolitaireSuit = (typeof solitaireSuits)[number];

export const SOLITAIRE_RANK_COUNT = 13;
export const SOLITAIRE_CARD_COUNT =
  solitaireSuits.length * SOLITAIRE_RANK_COUNT;
export const SOLITAIRE_KING_RANK = SOLITAIRE_RANK_COUNT;

/** 札の番号。`solitaireSuits` の順のマークの番号 × 13 ＋ 数 − 1（♠A が 0、♣K が 51）。 */
export type SolitaireCard = number;

export function getSolitaireCardSuit(card: SolitaireCard): SolitaireSuit {
  return solitaireSuits[Math.floor(card / SOLITAIRE_RANK_COUNT)]!;
}

/** A が 1、J・Q・K が 11・12・13。 */
export function getSolitaireCardRank(card: SolitaireCard): number {
  return (card % SOLITAIRE_RANK_COUNT) + 1;
}

export function createSolitaireCard(
  suit: SolitaireSuit,
  rank: number,
): SolitaireCard {
  return solitaireSuits.indexOf(suit) * SOLITAIRE_RANK_COUNT + rank - 1;
}

export function isRedSolitaireSuit(suit: SolitaireSuit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

export function isRedSolitaireCard(card: SolitaireCard): boolean {
  return isRedSolitaireSuit(getSolitaireCardSuit(card));
}

export function isSolitaireCard(value: unknown): value is SolitaireCard {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < SOLITAIRE_CARD_COUNT
  );
}

/** 列で `card` を `base` の上に重ねられる（数が1つ小さく、色が違う）。 */
export function canStackSolitaireCard(
  card: SolitaireCard,
  base: SolitaireCard,
): boolean {
  return (
    getSolitaireCardRank(card) + 1 === getSolitaireCardRank(base) &&
    isRedSolitaireCard(card) !== isRedSolitaireCard(base)
  );
}

const rankTexts = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
] as const;
const suitTexts = ["S", "H", "D", "C"] as const;

/** 札を `<数><マーク>` の字にする（`AS`・`10H`・`KC`）。導入調査の資料と同じ書き方。 */
function formatSolitaireCard(card: SolitaireCard): string {
  return `${rankTexts[getSolitaireCardRank(card) - 1]}${suitTexts[Math.floor(card / SOLITAIRE_RANK_COUNT)]}`;
}

/** `formatSolitaireCard` の書き方の札を読む。読めなければ `null`。 */
function parseSolitaireCard(text: string): SolitaireCard | null {
  const rankIndex = rankTexts.indexOf(
    text.slice(0, -1) as (typeof rankTexts)[number],
  );
  const suitIndex = suitTexts.indexOf(
    text.slice(-1) as (typeof suitTexts)[number],
  );
  return rankIndex < 0 || suitIndex < 0
    ? null
    : suitIndex * SOLITAIRE_RANK_COUNT + rankIndex;
}

export const _private = { formatSolitaireCard, parseSolitaireCard };
