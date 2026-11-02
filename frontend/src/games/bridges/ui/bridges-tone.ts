import type { BridgesIslandStatus } from "@/games/bridges/puzzle/rules";

/**
 * ブリッジパズル固有の色。共通UIの意味色（`primary`・`error` など）は流用しない。
 * - 盤面の地は、ライトでもダークでも盤面の外の地と分ける。
 * - 橋は島の縁と同じ濃い色の線にし、島と橋がひと続きの形に見えるようにする。
 * - 島は、本数が足りない間は地より明るい丸、ちょうどになったら地に沈む灰色の丸、多すぎたら盤面の中だけで使う薔薇色の丸にする。
 *   色だけに頼らないよう、縁の太さも状態で変える（ちょうどは細く、多すぎは太く）。数字はどの状態でも地の丸に対して 4.5:1 以上。
 * - 交わる橋に阻まれたときは、阻んだ橋を多すぎと同じ薔薇色で短く点ける（規則に合わないものの色）。
 * - 島を押している間に見せる、架けられる相手への線は、状態のどれとも紛れない空色にする。
 *   今離せば回す辺は濃い空色、どちらを狙ったか決まらない所を押したときの候補の辺は、架けられる相手への線と同じ淡い空色にする
 *   （どれも「架けられる所」の案内で、回す辺とは分ける）。
 */
export const bridgesToneClassNames = {
  ground: "fill-stone-100 dark:fill-stone-800",
  bridge: "stroke-stone-700 dark:stroke-stone-300",
  blockingBridge: "stroke-rose-500 dark:stroke-rose-400",
  guide: "stroke-sky-500/45 dark:stroke-sky-400/45",
  guidePreview: "stroke-sky-500 dark:stroke-sky-400",
  focusRing: "stroke-sky-600 dark:stroke-sky-300",
} as const;

type IslandTone = {
  disc: string;
  clue: string;
  /** 縁の太さ（マス幅を 1 とした値）。 */
  outlineWidth: number;
};

/** 数字と丸の輝度比: 足りない 17.5:1（白に stone-900）、ちょうど 6.9:1（stone-300 に stone-700。ダークは stone-600 に stone-200 で 6.1:1）、多すぎ 5.0:1（rose-100 に rose-700）。 */
export const bridgesIslandTones = {
  short: {
    disc: "fill-white stroke-stone-700 dark:fill-stone-950 dark:stroke-stone-300",
    clue: "fill-stone-900 dark:fill-stone-100",
    outlineWidth: 0.06,
  },
  exact: {
    disc: "fill-stone-300 stroke-stone-400 dark:fill-stone-600 dark:stroke-stone-500",
    clue: "fill-stone-700 dark:fill-stone-200",
    outlineWidth: 0.03,
  },
  over: {
    disc: "fill-rose-100 stroke-rose-600 dark:fill-rose-950 dark:stroke-rose-400",
    clue: "fill-rose-700 dark:fill-rose-300",
    outlineWidth: 0.1,
  },
} as const satisfies Record<BridgesIslandStatus, IslandTone>;
