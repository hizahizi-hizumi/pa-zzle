import type { CSSProperties } from "react";

import {
  findSolitaireRunStart,
  type SolitaireColumn,
} from "@/games/solitaire/puzzle/state";
import { solitaireTone } from "@/games/solitaire/ui/solitaire-tone";

/** 置き元に選んだ山の、動かせる札を囲む枠。札を持ち上げずに、札の外側へ縁を付ける。 */
export function getSolitaireSelectionFrameStyle(
  cardWidth: number,
): CSSProperties {
  return {
    outline: `2px solid ${solitaireTone.selection}`,
    outlineOffset: 1,
    borderRadius: cardWidth * 0.1,
  };
}

/** 列を置き元に選んだときに枠で囲む、手前から続く並びの、列の中での上端と高さ（px）。 */
export function getSolitaireColumnSelectionFrame({
  column,
  offset,
  cardHeight,
}: {
  column: SolitaireColumn;
  offset: number;
  cardHeight: number;
}): { top: number; height: number } {
  const runStart = findSolitaireRunStart(column);
  return {
    top: runStart * offset,
    height: (column.length - 1 - runStart) * offset + cardHeight,
  };
}
