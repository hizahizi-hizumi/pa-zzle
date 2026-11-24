import {
  canStackSolitaireCard,
  createSolitaireCard,
  SOLITAIRE_CARD_COUNT,
  type SolitaireCard,
  type SolitaireSuit,
  solitaireSuits,
} from "@/games/solitaire/puzzle/card";

export const SOLITAIRE_COLUMN_COUNT = 7;

/** 1つの列。一番奥の札から一番手前の札へ並ぶ。列の札はどれも表向き。 */
export type SolitaireColumn = readonly SolitaireCard[];

/** マークごとに組札に置いた札の枚数。組札には A から順に置くので、枚数がそのまま一番上の札の数になる。 */
export type SolitaireFoundations = Readonly<Record<SolitaireSuit, number>>;

/**
 * 解いている途中の盤面。
 * - `stock`: 裏向きの山札。先頭が次にめくる札。
 * - `waste`: 山札からめくった表向きの捨て札。最後が一番上。
 */
export type SolitaireState = {
  columns: readonly SolitaireColumn[];
  stock: readonly SolitaireCard[];
  waste: readonly SolitaireCard[];
  foundations: SolitaireFoundations;
};

export const emptySolitaireFoundations: SolitaireFoundations = {
  spades: 0,
  hearts: 0,
  diamonds: 0,
  clubs: 0,
};

export function createSolitaireInitialState(
  columns: readonly SolitaireColumn[],
  stock: readonly SolitaireCard[],
): SolitaireState {
  return {
    columns,
    stock,
    waste: [],
    foundations: emptySolitaireFoundations,
  };
}

export function countSolitaireFoundationCards(
  foundations: SolitaireFoundations,
): number {
  return solitaireSuits.reduce((count, suit) => count + foundations[suit], 0);
}

export function isSolitaireCleared(state: SolitaireState): boolean {
  return (
    countSolitaireFoundationCards(state.foundations) === SOLITAIRE_CARD_COUNT
  );
}

/** 組札の一番上の札。そのマークの組札が空なら `null`。 */
export function getSolitaireFoundationTop(
  foundations: SolitaireFoundations,
  suit: SolitaireSuit,
): SolitaireCard | null {
  const rank = foundations[suit];
  return rank === 0 ? null : createSolitaireCard(suit, rank);
}

/**
 * 列の一番手前から続く並び（赤黒交互・降順）の、一番奥の札の位置。ここから手前の札はまとめて動かせる。空の列は 0。
 */
export function findSolitaireRunStart(column: SolitaireColumn): number {
  let start = column.length - 1;
  while (
    start > 0 &&
    canStackSolitaireCard(column[start]!, column[start - 1]!)
  ) {
    start -= 1;
  }
  return Math.max(start, 0);
}

function isSameCardList(
  left: readonly SolitaireCard[],
  right: readonly SolitaireCard[],
): boolean {
  return (
    left === right ||
    (left.length === right.length &&
      left.every((card, index) => card === right[index]))
  );
}

export function isSameSolitaireState(
  left: SolitaireState,
  right: SolitaireState,
): boolean {
  return (
    left.columns.length === right.columns.length &&
    left.columns.every((column, index) =>
      isSameCardList(column, right.columns[index]!),
    ) &&
    isSameCardList(left.stock, right.stock) &&
    isSameCardList(left.waste, right.waste) &&
    solitaireSuits.every(
      (suit) => left.foundations[suit] === right.foundations[suit],
    )
  );
}
