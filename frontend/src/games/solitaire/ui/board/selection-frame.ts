import type { CSSProperties } from "react";

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
