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
  /** 置き元に選んだ札を囲む縁。 */
  selection: "#e0a400",
} as const;

export function getSolitaireSuitColor(suit: SolitaireSuit): string {
  return isRedSolitaireSuit(suit) ? solitaireTone.red : solitaireTone.black;
}

/** 画面の明暗の設定で変える、卓の色。 */
export const solitaireToneClassNames = {
  /** 盤の周囲の地。札を広げるフェルトの卓。 */
  ground: "bg-[#8fbf9f] dark:bg-[#183a29]",
  /** 札の無い山の跡。卓を少し沈めた面と細い縁で、紙の札と見分ける。 */
  emptySlot:
    "bg-[#0f3a22]/12 text-[#0f3a22]/45 shadow-[inset_0_0_0_1px_rgb(15_58_34/0.3)] dark:bg-white/5 dark:text-white/35 dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.2)]",
} as const;
