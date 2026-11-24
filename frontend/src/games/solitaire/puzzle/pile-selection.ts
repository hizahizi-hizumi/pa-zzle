import type { SolitaireSuit } from "@/games/solitaire/puzzle/card";
import {
  findSolitaireTransfer,
  getSolitaireStockTurn,
  type SolitaireDestination,
  type SolitaireMove,
  type SolitaireSource,
} from "@/games/solitaire/puzzle/rules";
import {
  getSolitaireFoundationTop,
  type SolitaireState,
} from "@/games/solitaire/puzzle/state";

/** 盤面で押せる山。組札はマークごとに別の山。 */
export type SolitairePile =
  | { pile: "stock" }
  | { pile: "waste" }
  | { pile: "column"; columnIndex: number }
  | { pile: "foundation"; suit: SolitaireSuit };

/**
 * 山を押したときに盤面が受け付けること。
 * - `source-selected` / `source-deselected`: 置き元の山を選んだ・選ぶのをやめた。
 * - `invalid`: 札の無い山を置き元に選ぼうとしたか、選んだ置き元から押した山へ置けない。
 * - `move`: 手を打つ。山札を押したときと、選んだ置き元から押した山へ置けるとき。
 */
export type SolitairePilePress =
  | { type: "source-selected" | "source-deselected"; source: SolitaireSource }
  | { type: "invalid"; pile: SolitairePile }
  | { type: "move"; move: SolitaireMove };

export function isSameSolitairePile(
  left: SolitairePile,
  right: SolitairePile,
): boolean {
  switch (left.pile) {
    case "stock":
    case "waste":
      return right.pile === left.pile;
    case "column":
      return right.pile === "column" && right.columnIndex === left.columnIndex;
    case "foundation":
      return right.pile === "foundation" && right.suit === left.suit;
  }
}

function hasSourceCard(
  state: SolitaireState,
  source: SolitaireSource,
): boolean {
  switch (source.pile) {
    case "column":
      return (state.columns[source.columnIndex]?.length ?? 0) > 0;
    case "waste":
      return state.waste.length > 0;
    case "foundation":
      return getSolitaireFoundationTop(state.foundations, source.suit) !== null;
  }
}

function toDestination(pile: SolitaireSource): SolitaireDestination | null {
  switch (pile.pile) {
    case "column":
      return pile;
    case "foundation":
      return { pile: "foundation" };
    case "waste":
      return null;
  }
}

/**
 * 置き元を `selectedSource` に選んでいる盤面で、`pile` を押す。
 * 山札を押すと、選んでいるかどうかに関わらず、めくるか捨て札を戻す。札のある山はどれも置き元に選べ、置けるかは置き先を押したときに決まる。
 * 組札は、どのマークの組札を押しても、置き先は札のマークの組札になる。
 */
export function pressSolitairePile(
  state: SolitaireState,
  selectedSource: SolitaireSource | null,
  pile: SolitairePile,
): SolitairePilePress {
  if (pile.pile === "stock") {
    const stockTurn = getSolitaireStockTurn(state);
    return stockTurn
      ? { type: "move", move: stockTurn }
      : { type: "invalid", pile };
  }
  if (selectedSource === null) {
    return hasSourceCard(state, pile)
      ? { type: "source-selected", source: pile }
      : { type: "invalid", pile };
  }
  if (isSameSolitairePile(selectedSource, pile)) {
    return { type: "source-deselected", source: selectedSource };
  }
  const destination = toDestination(pile);
  const transfer =
    destination && findSolitaireTransfer(state, selectedSource, destination);
  return transfer
    ? { type: "move", move: transfer }
    : { type: "invalid", pile };
}
