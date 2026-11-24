import {
  getSolitaireCardSuit,
  type SolitaireCard,
} from "@/games/solitaire/puzzle/card";
import type { SolitairePile } from "@/games/solitaire/puzzle/pile-selection";
import type {
  SolitaireMove,
  SolitaireSource,
} from "@/games/solitaire/puzzle/rules";
import {
  findSolitaireRunStart,
  getSolitaireFoundationTop,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";
import {
  getSolitaireColumnCardPosition,
  getSolitairePileTopPosition,
  type SolitaireBoardGeometry,
  type SolitaireCardPosition,
} from "@/games/solitaire/ui/board/board-geometry";

/** 盤面で動かす札の要素の名前。山札の裏の札は、札の番号ではなく `stock` と呼ぶ。 */
export type SolitaireCardMotionKey = `card-${SolitaireCard}` | "stock";

export function getSolitaireCardMotionKey(
  card: SolitaireCard,
): SolitaireCardMotionKey {
  return `card-${card}`;
}

/** 手を打って札が移った、札の要素と、移る前と後の位置。 */
export type SolitaireCardTravel = {
  key: SolitaireCardMotionKey;
  from: SolitaireCardPosition;
  to: SolitaireCardPosition;
};

type SolitaireBoardSnapshot = {
  state: SolitaireState;
  geometry: SolitaireBoardGeometry;
};

/** 置き元の山から動かす札と、動かす前の位置。列は手前の `cardCount` 枚、捨て札と組札は一番上の1枚。 */
function listSourceCards(
  { state, geometry }: SolitaireBoardSnapshot,
  source: SolitaireSource,
  cardCount: number,
): { card: SolitaireCard; position: SolitaireCardPosition }[] {
  if (source.pile === "column") {
    const column = state.columns[source.columnIndex] ?? [];
    return column.slice(-cardCount).map((card, index) => ({
      card,
      position: getSolitaireColumnCardPosition(
        geometry,
        source.columnIndex,
        column.length - cardCount + index,
      ),
    }));
  }
  const card =
    source.pile === "waste"
      ? state.waste.at(-1)
      : getSolitaireFoundationTop(state.foundations, source.suit);
  return card === undefined || card === null
    ? []
    : [
        {
          card,
          position: getSolitairePileTopPosition(geometry, state, source),
        },
      ];
}

/** 手を打つ前と後の盤面から、移った札ごとの位置の組を求める。札を動かさない手は無い。 */
export function listSolitaireMoveTravels(
  move: SolitaireMove,
  before: SolitaireBoardSnapshot,
  after: SolitaireBoardSnapshot,
): SolitaireCardTravel[] {
  switch (move.kind) {
    case "draw": {
      const card = before.state.stock[0];
      return card === undefined
        ? []
        : [
            {
              key: getSolitaireCardMotionKey(card),
              from: getSolitairePileTopPosition(before.geometry, before.state, {
                pile: "stock",
              }),
              to: getSolitairePileTopPosition(after.geometry, after.state, {
                pile: "waste",
              }),
            },
          ];
    }
    case "recycle":
      return [
        {
          key: "stock",
          from: getSolitairePileTopPosition(before.geometry, before.state, {
            pile: "waste",
          }),
          to: getSolitairePileTopPosition(after.geometry, after.state, {
            pile: "stock",
          }),
        },
      ];
    case "transfer": {
      const { destination, cardCount } = move;
      const moved = listSourceCards(before, move.source, cardCount);
      return moved.map(({ card, position }, index) => {
        const to =
          destination.pile === "column"
            ? getSolitaireColumnCardPosition(
                after.geometry,
                destination.columnIndex,
                (after.state.columns[destination.columnIndex]?.length ?? 0) -
                  cardCount +
                  index,
              )
            : getSolitairePileTopPosition(after.geometry, after.state, {
                pile: "foundation",
                suit: getSolitaireCardSuit(card),
              });
        return { key: getSolitaireCardMotionKey(card), from: position, to };
      });
    }
  }
}

/** 置けない山へ札を向けて戻す動き。`dx`・`dy` は、札が置き先へ向かっていちばん進んだときのずれ（px）。 */
export type SolitaireBump = {
  keys: readonly SolitaireCardMotionKey[];
  dx: number;
  dy: number;
};

/** 置き先へ向かう距離の割合と、その上下限（札の高さに対する割合と px）。 */
const bumpTravelRatio = 0.35;
const bumpMinimumTravelPx = 12;
const bumpMaximumTravelCardHeightRatio = 0.5;

/**
 * 置き元の山で動かせる札（列は手前から続く並び、捨て札と組札は一番上の札）を、置けない山 `target` の一番上の札へ向けて進める向きと距離。
 * 進む距離は、離れた山ほど長く、札の高さの半分までにする。
 */
export function getSolitaireBump(
  snapshot: SolitaireBoardSnapshot,
  source: SolitaireSource,
  target: SolitairePile,
): SolitaireBump | null {
  const { state, geometry } = snapshot;
  const column =
    source.pile === "column" ? (state.columns[source.columnIndex] ?? []) : [];
  const cardCount =
    source.pile === "column"
      ? column.length - findSolitaireRunStart(column)
      : 1;
  const cards = listSourceCards(snapshot, source, cardCount);
  const [first] = cards;
  if (first === undefined) {
    return null;
  }
  const targetPosition = getSolitairePileTopPosition(geometry, state, target);
  const x = targetPosition.left - first.position.left;
  const y = targetPosition.top - first.position.top;
  const distance = Math.hypot(x, y);
  if (distance === 0) {
    return null;
  }
  const travel = Math.min(
    Math.max(distance * bumpTravelRatio, bumpMinimumTravelPx),
    geometry.cardHeight * bumpMaximumTravelCardHeightRatio,
    distance,
  );
  return {
    keys: cards.map(({ card }) => getSolitaireCardMotionKey(card)),
    dx: (x / distance) * travel,
    dy: (y / distance) * travel,
  };
}
