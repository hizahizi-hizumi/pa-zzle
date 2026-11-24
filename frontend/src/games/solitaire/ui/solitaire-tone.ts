import {
  isRedSolitaireSuit,
  type SolitaireSuit,
} from "@/games/solitaire/puzzle/card";

/**
 * 卓に置いたトランプの絵の色で、共通UIの意味色（`primary`・`ring` など）は流用しない。
 * 札は紙なので、画面の明暗の設定によらず同じ色にする。
 */
export const solitaireTone = {
  cardFace: "#fbfaf6",
  cardEdge: "#c3cac4",
  red: "#c4223a",
  black: "#1c2229",
  cardBack: "#2f5f86",
  cardBackStripe: "#4b7ca5",
  /** 札の無い山の跡。卓の地の上に、紙の札と見分けられる薄い枠で描く。 */
  emptySlotEdge: "rgba(36,72,52,0.28)",
  emptySlotMark: "rgba(36,72,52,0.32)",
  /** 置き元に選んだ札を囲む縁。 */
  selection: "#e0a400",
} as const;

export function getSolitaireSuitColor(suit: SolitaireSuit): string {
  return isRedSolitaireSuit(suit) ? solitaireTone.red : solitaireTone.black;
}
