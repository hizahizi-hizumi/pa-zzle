import type { BridgesIslandStatus } from "@/games/bridges/puzzle/rules";

/**
 * ブリッジパズル固有の色。題材の海・島・木の橋から選び、共通UIの意味色（`primary`・`error` など）は流用しない。
 * - 海は盤面の周りから盤面の地まで、ブランドの帯と見出しの後ろまで同じ色でつなげる。ライトは青緑、ダークは深い青緑にし、
 *   島の周りだけを浅瀬の明るい色にぼかして、島から離れるほど深く見せる。平常時は動かさない。
 *   ダークの海はページの地と 1.7:1 ほど離し、黒い地に沈ませない。
 * - 島は砂浜の陸にし、陸の縁の濡れた砂、波打ち際の白い泡、浅瀬の順に海へつなげる。影は落とさず、円盤やボタンに見せない。
 * - 橋は木の板にする。欄干の濃い茶で縁取った板に淡い横木を間引いて刻み、両端の浅瀬に杭を立てる。
 *   ダークでも欄干と海を 2:1 以上離す。
 * - 交わる橋に阻まれたときは、阻んだ橋を多すぎの島と同じ薔薇色で短く点ける（規則に合わないものの色）。
 * - 島から架けられる相手へ張るロープ（なぞる間と、島を選んでいる間）は、海・板・どの島の状態とも紛れない紺（ダークは白）にし、
 *   板の上でも読めるよう反対の明るさの縁で囲む。離せば架かる辺には、架かった後の板の影を半透明で置く。
 * - 全島がつながった瞬間は、島が灯り、島の周りの浅瀬が光って、最後に海全体が一段明るい青緑になる。
 *   完成した盤面を、解く間のどの盤面より鮮やかに見せる。
 */
export const bridgesToneClassNames = {
  sea: "bg-[#6fbac6] dark:bg-[#133e52]",
  seaFill: "fill-[#6fbac6] dark:fill-[#133e52]",
  /** 全島がつながった後の、一段明るく鮮やかな海。平常時の海の上に重ねる。 */
  seaLit: "bg-[#2fc1bd] dark:bg-[#17707e]",
  seaLitFill: "fill-[#2fc1bd] dark:fill-[#17707e]",
  /** 海の上の、動かない波の印。 */
  seaWave: "stroke-white/45 dark:stroke-[#86c9db]/40",
  /** 島の周りの浅瀬。島から離れるほど透けて海の色に戻す。 */
  shallowsStop: "[stop-color:#c4ece6] dark:[stop-color:#2b7584]",
  /** 陸の縁の、濡れて色の濃い砂。 */
  wetSand: "stroke-[#d6b77c] dark:stroke-[#b99a62]",
  /** 波打ち際の泡。 */
  surf: "stroke-white/85 dark:stroke-[#d9f3f2]/70",
  bridgeShadow: "stroke-[#1f5a63]/30 dark:stroke-black/40",
  bridgeRail: "stroke-[#6e4523] dark:stroke-[#94663a]",
  bridgeDeck: "stroke-[#ba844c] dark:stroke-[#c99358]",
  bridgeSeam: "stroke-[#7d5129]/45 dark:stroke-[#6e4522]/45",
  bridgePost: "fill-[#4f2f15] dark:fill-[#3a230f]",
  blockingBridge: "stroke-rose-500 dark:stroke-rose-400",
  guideCasing: "stroke-white/90 dark:stroke-[#06202b]/90",
  guide: "stroke-[#0f4466] dark:stroke-[#eefaff]",
  /** 離せば架かる板の影。 */
  guideGhost: "stroke-[#9a6534]/55 dark:stroke-[#e2b27a]/55",
  /** 離せば外れる板に重ねる、海の色の覆い。 */
  guideRemoval: "stroke-[#6fbac6]/75 dark:stroke-[#133e52]/75",
  focusRing: "stroke-sky-800 dark:stroke-sky-300",
  /** 灯った島の、陸の後ろの暖かい光。 */
  lanternStop: "[stop-color:#f5b82e] dark:[stop-color:#ffc94a]",
  /** 灯った島の杭の灯り。 */
  lanternPost: "fill-[#ffd75e] dark:fill-[#ffe58a]",
  /** 灯った島の周りで光る浅瀬。 */
  lagoonStop: "[stop-color:#7ff2dc] dark:[stop-color:#3fd3c4]",
  /** 灯った島から海へ広がる波紋。 */
  ripple: "stroke-[#f2fffc] dark:stroke-[#b5f3ef]",
} as const;

/**
 * 島の状態ごとの陸の姿。色だけに頼らず、形でも分ける。
 * - `short`（足りない）: 砂の陸だけ。
 * - `exact`（ちょうど）: 砂の縁を残して、中に草地が広がる。陸の輪郭は変えず、内側の草地の有無で見分ける。
 * - `over`（多すぎ）: 薔薇色の陸に、途切れた太い縁。
 * - `grass`: 草地の色。草地の無い状態は持たない。
 * - `rimDash`: 陸の縁を途切れさせる間隔（マス幅を 1 とした値）。途切れない縁は持たない。
 */
export type BridgesIslandTone = {
  land: string;
  clue: string;
  grass?: string;
  rim?: string;
  rimDash?: string;
};

export const bridgesIslandTones: Readonly<
  Record<BridgesIslandStatus, BridgesIslandTone>
> = {
  short: {
    land: "fill-[#f7e8c6] dark:fill-[#e6d3a3]",
    clue: "fill-[#4a3218] dark:fill-[#3a2810]",
  },
  exact: {
    land: "fill-[#f7e8c6] dark:fill-[#e6d3a3]",
    grass: "fill-[#7fca55] dark:fill-[#72bf4c]",
    clue: "fill-[#123a0e] dark:fill-[#0d2a0a]",
  },
  over: {
    land: "fill-[#ffd4cf] dark:fill-[#fda4af]",
    rim: "stroke-[#e0475e] dark:stroke-[#fb7185]",
    rimDash: "0.13 0.08",
    clue: "fill-[#9f1239] dark:fill-[#4c0519]",
  },
};
