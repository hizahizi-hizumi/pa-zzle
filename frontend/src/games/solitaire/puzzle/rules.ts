import {
  canStackSolitaireCard,
  getSolitaireCardRank,
  getSolitaireCardSuit,
  SOLITAIRE_KING_RANK,
  type SolitaireCard,
  type SolitaireSuit,
  solitaireSuits,
} from "@/games/solitaire/puzzle/card";
import {
  findSolitaireRunStart,
  getSolitaireFoundationTop,
  SOLITAIRE_COLUMN_COUNT,
  type SolitaireColumn,
  type SolitaireFoundations,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";

/** 札を取り出せる山。組札はマークごとに別の山。 */
export type SolitaireSource =
  | { pile: "column"; columnIndex: number }
  | { pile: "waste" }
  | { pile: "foundation"; suit: SolitaireSuit };

/** 札を置ける山。組札へは札のマークの組札へ置くので、どのマークの組札かを持たない。 */
export type SolitaireDestination =
  | { pile: "column"; columnIndex: number }
  | { pile: "foundation" };

/**
 * 置き元の山の手前の札を、置き先の山へ動かす手。`cardCount` は動かす札の枚数で、列から列へ並びを動かすときだけ2以上になる。
 * 置き元の山と置き先の山の組で、動かせる札の枚数は1通りに決まる（`findSolitaireTransfer`）。
 */
export type SolitaireTransfer = {
  kind: "transfer";
  source: SolitaireSource;
  destination: SolitaireDestination;
  cardCount: number;
};

/** 山札を押す手。山札が残っていれば1枚めくり（`draw`）、空なら捨て札を山札へ戻す（`recycle`）。 */
export type SolitaireStockTurn = { kind: "draw" } | { kind: "recycle" };

export type SolitaireMove = SolitaireTransfer | SolitaireStockTurn;

const solitaireSources: readonly SolitaireSource[] = [
  ...Array.from(
    { length: SOLITAIRE_COLUMN_COUNT },
    (_, columnIndex): SolitaireSource => ({ pile: "column", columnIndex }),
  ),
  { pile: "waste" },
  ...solitaireSuits.map(
    (suit): SolitaireSource => ({ pile: "foundation", suit }),
  ),
];

const solitaireDestinations: readonly SolitaireDestination[] = [
  ...Array.from(
    { length: SOLITAIRE_COLUMN_COUNT },
    (_, columnIndex): SolitaireDestination => ({ pile: "column", columnIndex }),
  ),
  { pile: "foundation" },
];

/** 列の一番手前に `card` を置ける。空いた列には K だけを置ける。 */
export function canPlaceSolitaireCardOnColumn(
  card: SolitaireCard,
  column: SolitaireColumn,
): boolean {
  const base = column.at(-1);
  return base === undefined
    ? getSolitaireCardRank(card) === SOLITAIRE_KING_RANK
    : canStackSolitaireCard(card, base);
}

/** 札のマークの組札に `card` を置ける。組札へは A から数の順に置く。 */
export function canPlaceSolitaireCardOnFoundation(
  foundations: SolitaireFoundations,
  card: SolitaireCard,
): boolean {
  return (
    foundations[getSolitaireCardSuit(card)] + 1 === getSolitaireCardRank(card)
  );
}

/** 置き元の山から1枚だけ動かせる札。列は一番手前、捨て札は一番上、組札は一番上の札。空なら `null`。 */
function getSolitaireSourceTop(
  state: SolitaireState,
  source: SolitaireSource,
): SolitaireCard | null {
  switch (source.pile) {
    case "column":
      return state.columns[source.columnIndex]?.at(-1) ?? null;
    case "waste":
      return state.waste.at(-1) ?? null;
    case "foundation":
      return getSolitaireFoundationTop(state.foundations, source.suit);
  }
}

/**
 * 列から別の列へ動かせる札の枚数。動かす並びの一番奥の札は、置き先の手前の札に重ねられる札か、置き先が空なら K に限る。
 * 並びの中の札は数がどれも違うので、置き先に重ねられる札は高々1枚に決まる。
 * 一番奥から K で始まる列を丸ごと空いた列へ動かす手は、列を入れ替えるだけで盤面が変わらないので打てない。
 */
function countColumnToColumnCards(
  column: SolitaireColumn,
  destination: SolitaireColumn,
): number {
  const runStart = findSolitaireRunStart(column);
  const base = destination.at(-1);
  for (let index = runStart; index < column.length; index += 1) {
    const card = column[index]!;
    const fits =
      base === undefined
        ? getSolitaireCardRank(card) === SOLITAIRE_KING_RANK && index > 0
        : canStackSolitaireCard(card, base);
    if (fits) {
      return column.length - index;
    }
  }
  return 0;
}

/** 置き元の山と置き先の山の組で打てる手。打てなければ `null`。 */
export function findSolitaireTransfer(
  state: SolitaireState,
  source: SolitaireSource,
  destination: SolitaireDestination,
): SolitaireTransfer | null {
  const card = getSolitaireSourceTop(state, source);
  if (card === null) {
    return null;
  }

  let cardCount = 0;
  if (destination.pile === "foundation") {
    cardCount =
      source.pile !== "foundation" &&
      canPlaceSolitaireCardOnFoundation(state.foundations, card)
        ? 1
        : 0;
  } else if (
    !(
      source.pile === "column" && source.columnIndex === destination.columnIndex
    )
  ) {
    const destinationColumn = state.columns[destination.columnIndex];
    if (!destinationColumn) {
      return null;
    }
    cardCount =
      source.pile === "column"
        ? countColumnToColumnCards(
            state.columns[source.columnIndex]!,
            destinationColumn,
          )
        : canPlaceSolitaireCardOnColumn(card, destinationColumn)
          ? 1
          : 0;
  }

  return cardCount === 0
    ? null
    : { kind: "transfer", source, destination, cardCount };
}

export function getSolitaireStockTurn(
  state: SolitaireState,
): SolitaireStockTurn | null {
  if (state.stock.length > 0) {
    return { kind: "draw" };
  }
  return state.waste.length > 0 ? { kind: "recycle" } : null;
}

/** 今の盤面で打てる手のすべて。置き元の山と置き先の山の組ごとに1つずつと、山札を押す手。 */
function listSolitaireMoves(state: SolitaireState): SolitaireMove[] {
  const moves: SolitaireMove[] = [];
  for (const source of solitaireSources) {
    for (const destination of solitaireDestinations) {
      const transfer = findSolitaireTransfer(state, source, destination);
      if (transfer) {
        moves.push(transfer);
      }
    }
  }
  const stockTurn = getSolitaireStockTurn(state);
  if (stockTurn) {
    moves.push(stockTurn);
  }
  return moves;
}

function removeSolitaireSourceCards(
  state: SolitaireState,
  source: SolitaireSource,
  cardCount: number,
): { state: SolitaireState; cards: readonly SolitaireCard[] } {
  switch (source.pile) {
    case "column": {
      const column = state.columns[source.columnIndex]!;
      const columns = [...state.columns];
      columns[source.columnIndex] = column.slice(0, -cardCount);
      return {
        state: { ...state, columns },
        cards: column.slice(-cardCount),
      };
    }
    case "waste":
      return {
        state: { ...state, waste: state.waste.slice(0, -1) },
        cards: state.waste.slice(-1),
      };
    case "foundation":
      return {
        state: {
          ...state,
          foundations: {
            ...state.foundations,
            [source.suit]: state.foundations[source.suit] - 1,
          },
        },
        cards: [getSolitaireFoundationTop(state.foundations, source.suit)!],
      };
  }
}

function applySolitaireTransfer(
  state: SolitaireState,
  { source, destination, cardCount }: SolitaireTransfer,
): SolitaireState {
  const removed = removeSolitaireSourceCards(state, source, cardCount);
  if (destination.pile === "foundation") {
    const suit = getSolitaireCardSuit(removed.cards[0]!);
    return {
      ...removed.state,
      foundations: {
        ...removed.state.foundations,
        [suit]: removed.state.foundations[suit] + 1,
      },
    };
  }
  const columns = [...removed.state.columns];
  columns[destination.columnIndex] = [
    ...columns[destination.columnIndex]!,
    ...removed.cards,
  ];
  return { ...removed.state, columns };
}

/** 手を打った後の盤面。今の盤面で打てない手なら `null`。 */
export function applySolitaireMove(
  state: SolitaireState,
  move: SolitaireMove,
): SolitaireState | null {
  if (move.kind === "draw") {
    const [card, ...stock] = state.stock;
    return card === undefined
      ? null
      : { ...state, stock, waste: [...state.waste, card] };
  }
  if (move.kind === "recycle") {
    return getSolitaireStockTurn(state)?.kind === "recycle"
      ? { ...state, stock: state.waste, waste: [] }
      : null;
  }

  const transfer = findSolitaireTransfer(state, move.source, move.destination);
  return transfer?.cardCount === move.cardCount
    ? applySolitaireTransfer(state, transfer)
    : null;
}

export const _private = { listSolitaireMoves };
