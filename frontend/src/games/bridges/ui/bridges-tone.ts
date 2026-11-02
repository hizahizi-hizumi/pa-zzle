import type { BridgesIslandStatus } from "@/games/bridges/puzzle/rules";

/**
 * ブリッジパズル固有の色。共通UIの意味色（`primary`・`error` など）は流用しない。
 * - 盤面の地は、ライトでもダークでも盤面の外の地と分ける。
 * - 橋は島の縁と同じ濃い色の線にし、島と橋がひと続きの形に見えるようにする。
 * - 島は、本数が足りない間は地より明るい丸、ちょうどになったら地に沈む灰色の丸、多すぎたら盤面の中だけで使う薔薇色の丸にする。
 *   色だけに頼らないよう、縁の太さも状態で変える（ちょうどは細く、多すぎは太く）。
 */
export const bridgesToneClassNames = {
  ground: "fill-stone-100 dark:fill-stone-800",
  bridge: "stroke-stone-700 dark:stroke-stone-300",
} as const;

type IslandTone = {
  disc: string;
  clue: string;
  /** 縁の太さ（マス幅を 1 とした値）。 */
  outlineWidth: number;
};

export const bridgesIslandTones = {
  short: {
    disc: "fill-white stroke-stone-700 dark:fill-stone-950 dark:stroke-stone-300",
    clue: "fill-stone-900 dark:fill-stone-100",
    outlineWidth: 0.06,
  },
  exact: {
    disc: "fill-stone-300 stroke-stone-400 dark:fill-stone-600 dark:stroke-stone-500",
    clue: "fill-stone-500 dark:fill-stone-300",
    outlineWidth: 0.03,
  },
  over: {
    disc: "fill-rose-100 stroke-rose-600 dark:fill-rose-950 dark:stroke-rose-400",
    clue: "fill-rose-700 dark:fill-rose-300",
    outlineWidth: 0.1,
  },
} as const satisfies Record<BridgesIslandStatus, IslandTone>;
